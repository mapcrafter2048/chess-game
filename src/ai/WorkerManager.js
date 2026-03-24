// Worker Manager for Parallel Chess Search (Phase 2B)
// Manages worker pool, distributes work, aggregates results

import { SEARCH_CONFIG } from './constants.js';
import TranspositionTable from './TranspositionTable.js';

class WorkerManager {
    constructor() {
        this.workers = [];
        this.transpositionTable = null;
        this.isInitialized = false;
        this.initializationPromise = null;
    }

    /**
     * Initialize worker pool and shared transposition table
     * @returns {Promise<boolean>} True if initialization successful
     */
    async initialize() {
        // Return existing promise if already initializing
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        // Return true if already initialized
        if (this.isInitialized) {
            return Promise.resolve(true);
        }

        this.initializationPromise = this._doInitialize();
        return this.initializationPromise;
    }

    async _doInitialize() {
        try {
            console.log('🔧 Initializing WorkerManager...');

            // Check SharedArrayBuffer availability
            if (typeof SharedArrayBuffer === 'undefined') {
                console.warn('⚠️  SharedArrayBuffer not available, falling back to single-threaded');
                return false;
            }

            // Create shared transposition table
            this.transpositionTable = new TranspositionTable(
                SEARCH_CONFIG.TRANSPOSITION_TABLE_SIZE_MB
            );

            if (!this.transpositionTable.isSharedBuffer()) {
                console.warn('⚠️  Could not create SharedArrayBuffer, falling back to single-threaded');
                return false;
            }

            console.log(`✅ Created shared TranspositionTable: ${SEARCH_CONFIG.TRANSPOSITION_TABLE_SIZE_MB}MB`);

            // Create workers
            const workerPromises = [];
            for (let i = 0; i < SEARCH_CONFIG.NUM_WORKERS; i++) {
                const workerPromise = this._createWorker(i);
                workerPromises.push(workerPromise);
            }

            // Wait for all workers to initialize
            const results = await Promise.all(workerPromises);
            const successCount = results.filter(r => r).length;

            if (successCount === 0) {
                console.error('❌ Failed to initialize any workers');
                this.cleanup();
                return false;
            }

            if (successCount < SEARCH_CONFIG.NUM_WORKERS) {
                console.warn(`⚠️  Only ${successCount}/${SEARCH_CONFIG.NUM_WORKERS} workers initialized`);
            } else {
                console.log(`✅ Initialized ${successCount} workers successfully`);
            }

            this.isInitialized = true;
            return true;

        } catch (error) {
            console.error('❌ WorkerManager initialization failed:', error);
            this.cleanup();
            return false;
        }
    }

    /**
     * Create and initialize a single worker
     * @param {number} workerId - Worker index
     * @returns {Promise<boolean>} True if worker initialized successfully
     */
    async _createWorker(workerId) {
        return new Promise((resolve) => {
            try {
                // Create worker (Vite will handle bundling)
                const worker = new Worker(
                    new URL('./searchWorker.js', import.meta.url),
                    { type: 'module' }
                );

                const workerState = {
                    id: workerId,
                    worker,
                    isReady: false,
                    isBusy: false,
                    messageHandlers: new Map()
                };

                // Handle worker messages
                worker.onmessage = (event) => {
                    const { type, ...data } = event.data;

                    // Handle initialization messages
                    if (type === 'READY') {
                        console.log(`Worker ${workerId} ready, sending TT buffer...`);

                        // Send shared TT buffer
                        worker.postMessage({
                            type: 'INIT_TT',
                            data: {
                                sizeInMB: SEARCH_CONFIG.TRANSPOSITION_TABLE_SIZE_MB,
                                ttBuffer: this.transpositionTable.getBuffer()
                            }
                        });
                        return;
                    }

                    if (type === 'INIT_TT_SUCCESS') {
                        console.log(`✅ Worker ${workerId} initialized with shared TT (shared: ${data.isShared})`);
                        workerState.isReady = true;
                        resolve(true);
                        return;
                    }

                    // Route messages to registered handlers
                    const handler = workerState.messageHandlers.get(type);
                    if (handler) {
                        handler(data);
                    }
                };

                worker.onerror = (error) => {
                    console.error(`❌ Worker ${workerId} error:`, error);
                    workerState.isReady = false;
                    resolve(false);
                };

                this.workers.push(workerState);

                // Timeout if worker doesn't initialize
                setTimeout(() => {
                    if (!workerState.isReady) {
                        console.warn(`⚠️  Worker ${workerId} initialization timeout`);
                        resolve(false);
                    }
                }, 5000);

            } catch (error) {
                console.error(`❌ Failed to create worker ${workerId}:`, error);
                resolve(false);
            }
        });
    }

    /**
     * Search for best move using parallel workers (root splitting)
     * @param {Object} params - Search parameters
     * @returns {Promise<Object>} Best move and metadata
     */
    async searchParallel({ board, currentTurn, castlingRights, enPassantTarget, moves, depth }) {
        if (!this.isInitialized) {
            throw new Error('WorkerManager not initialized');
        }

        const startTime = performance.now();

        // Distribute moves across workers (contiguous chunks)
        const moveBatches = this._distributeMoves(moves);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🔍 Starting Parallel Search (Phase 2B)');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`⚙️  Workers: ${SEARCH_CONFIG.NUM_WORKERS}`);
        console.log(`📊 Depth: ${depth} ply`);
        console.log(`🎯 Total moves: ${moves.length}`);
        moveBatches.forEach((batch, i) => {
            console.log(`   Worker ${i}: ${batch.length} moves`);
        });

        // Send search tasks to workers
        const searchPromises = moveBatches.map((batch, workerIndex) => {
            return this._searchWithWorker(workerIndex, {
                    board,
                    currentTurn,
                    castlingRights,
                    enPassantTarget,
                    movesToSearch: batch,
                    depth,
                    timeoutMs: SEARCH_CONFIG.MAX_SEARCH_TIME_MS
            });
        });

        // Wait for all workers to complete
        const results = await Promise.all(searchPromises);

        // Find best move across all workers and aggregate stats
        let bestMove = null;
        let bestScore = -Infinity;
        let totalNodes = 0;

        // Aggregate TT stats from all workers
        const aggregatedTTStats = {
            hits: 0,
            misses: 0,
            collisions: 0,
            stores: 0
        };

        results.forEach((result, workerIndex) => {
            if (result && result.bestMove && result.bestScore > bestScore) {
                bestScore = result.bestScore;
                bestMove = result.bestMove;
            }
            totalNodes += result?.nodesSearched || 0;

            // Aggregate TT stats from this worker
            if (result?.ttStats) {
                aggregatedTTStats.hits += result.ttStats.hits || 0;
                aggregatedTTStats.misses += result.ttStats.misses || 0;
                aggregatedTTStats.collisions += result.ttStats.collisions || 0;
                aggregatedTTStats.stores += result.ttStats.stores || 0;
            }
        });

        const endTime = performance.now();
        const searchTime = endTime - startTime;
        const nps = Math.floor(totalNodes / (searchTime / 1000));

        // Calculate aggregate TT hit rate
        const totalProbes = aggregatedTTStats.hits + aggregatedTTStats.misses;
        const hitRate = totalProbes > 0
            ? ((aggregatedTTStats.hits / totalProbes) * 100).toFixed(2) + '%'
            : '0.00%';

        // Log results
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 Parallel Search Results');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`⏱️  Time: ${searchTime.toFixed(2)}ms`);
        console.log(`🎯 Best Score: ${bestScore} centipawns`);
        console.log(`📈 Total Nodes: ${totalNodes.toLocaleString()} (${nps.toLocaleString()} nps)`);

        // Detailed per-worker performance table
        console.log('\n📊 Per-Worker Breakdown:');
        console.log('┌────────┬────────┬───────────┬───────────┬────────────┬──────────┬──────────┬────────────┐');
        console.log('│ Worker │ Moves  │ Searched  │ Time (ms) │ Nodes      │ Nodes/s  │ TT Hits  │ Hit Rate   │');
        console.log('├────────┼────────┼───────────┼───────────┼────────────┼──────────┼──────────┼────────────┤');

        results.forEach((result, index) => {
            if (result) {
                const workerTime = result.searchTime || 0;
                const nodesPerSec = workerTime > 0 ? Math.round((result.nodesSearched / workerTime) * 1000) : 0;
                const workerTTOps = (result.ttStats?.hits || 0) + (result.ttStats?.misses || 0);
                const workerHitRate = workerTTOps > 0 ? ((result.ttStats?.hits || 0) / workerTTOps * 100).toFixed(1) : '0.0';
                const betaCutoffPct = result.movesAssigned > 0 ? ((result.betaCutoffs || 0) / result.movesAssigned * 100).toFixed(0) : '0';

                console.log(
                    `│   ${index}    │   ${String(result.movesAssigned || 0).padStart(2)}   │    ${String(result.movesSearched || 0).padStart(2)}     │  ${String(workerTime.toFixed(1)).padStart(7)}  │ ${String(result.nodesSearched.toLocaleString()).padStart(10)} │ ${String(nodesPerSec.toLocaleString()).padStart(8)} │ ${String((result.ttStats?.hits || 0).toLocaleString()).padStart(8)} │ ${String(workerHitRate).padStart(5)}% (β:${betaCutoffPct}%) │`
                );
            }
        });

        console.log('└────────┴────────┴───────────┴───────────┴────────────┴──────────┴──────────┴────────────┘');

        // Calculate parallel efficiency
        const maxWorkerTime = Math.max(...results.map(r => r?.searchTime || 0));
        const minWorkerTime = Math.min(...results.map(r => r?.searchTime || 0).filter(t => t > 0));
        const avgWorkerTime = results.reduce((sum, r) => sum + (r?.searchTime || 0), 0) / results.length;
        const loadImbalance = maxWorkerTime > 0 ? ((maxWorkerTime - minWorkerTime) / maxWorkerTime * 100).toFixed(1) : '0.0';

        console.log(`\n⚡ Parallel Efficiency Analysis:`);
        console.log(`   Worker times: min=${minWorkerTime.toFixed(1)}ms, avg=${avgWorkerTime.toFixed(1)}ms, max=${maxWorkerTime.toFixed(1)}ms`);
        console.log(`   Load imbalance: ${loadImbalance}% (lower is better)`);
        console.log(`   Parallel overhead: ${(searchTime - maxWorkerTime).toFixed(1)}ms`);

        // Log aggregated TT stats from all workers
        console.log(`\n💾 TT Stats (aggregated from all workers):`);
        console.log(`   Hits: ${aggregatedTTStats.hits} (${hitRate})`);
        console.log(`   Misses: ${aggregatedTTStats.misses}`);
        console.log(`   Stores: ${aggregatedTTStats.stores}`);
        console.log(`   Collisions: ${aggregatedTTStats.collisions}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        return {
            bestMove,
            bestScore,
            totalNodes,
            searchTime,
            nps,
            workerResults: results
        };
    }

    /**
     * Distribute moves across workers (contiguous chunks)
     * @param {Array} moves - All legal moves
     * @returns {Array<Array>} Array of move batches for each worker
     */
    _distributeMoves(moves) {
        // Contiguous chunk distribution - each worker gets a consecutive slice
        const batches = [];
        const chunkSize = Math.ceil(moves.length / SEARCH_CONFIG.NUM_WORKERS);

        for (let i = 0; i < SEARCH_CONFIG.NUM_WORKERS; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, moves.length);
            const batch = moves.slice(start, end);

            if (batch.length > 0) {
                batches.push(batch);
            }
        }

        return batches;
    }

    /**
     * Send search task to specific worker
     * @param {number} workerIndex - Worker index
     * @param {Object} searchData - Search parameters
     * @returns {Promise<Object>} Search result
     */
    _searchWithWorker(workerIndex, searchData) {
        return new Promise((resolve, reject) => {
            const workerState = this.workers[workerIndex];

            if (!workerState || !workerState.isReady) {
                reject(new Error(`Worker ${workerIndex} not ready`));
                return;
            }

            let timeoutId = null;
            let resolved = false;

            // Set up result handler
            const resultHandler = (data) => {
                if (resolved) return; // Already handled
                resolved = true;

                clearTimeout(timeoutId);
                workerState.isBusy = false;
                workerState.messageHandlers.delete('SEARCH_RESULT');
                workerState.messageHandlers.delete('ERROR');
                resolve(data);
            };

            const errorHandler = (data) => {
                if (resolved) return; // Already handled
                resolved = true;

                clearTimeout(timeoutId);
                workerState.isBusy = false;
                workerState.messageHandlers.delete('SEARCH_RESULT');
                workerState.messageHandlers.delete('ERROR');
                reject(new Error(data.error));
            };

            workerState.messageHandlers.set('SEARCH_RESULT', resultHandler);
            workerState.messageHandlers.set('ERROR', errorHandler);

            // Send search task
            workerState.isBusy = true;
            workerState.worker.postMessage({
                type: 'SEARCH',
                data: searchData
            });

            // Timeout fallback (only fires if worker truly hangs)
            timeoutId = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    console.warn(`⚠️  Worker ${workerIndex} timeout after ${SEARCH_CONFIG.MAX_SEARCH_TIME_MS}ms`);
                    workerState.worker.postMessage({ type: 'CANCEL' });
                    workerState.isBusy = false;
                    workerState.messageHandlers.delete('SEARCH_RESULT');
                    workerState.messageHandlers.delete('ERROR');
                    resolve({ bestMove: null, bestScore: -Infinity, nodesSearched: 0, timedOut: true });
                }
            }, SEARCH_CONFIG.MAX_SEARCH_TIME_MS + 1000);
        });
    }

    /**
     * Clear transposition table
     */
    clearTranspositionTable() {
        if (this.transpositionTable) {
            this.transpositionTable.clear();
        }
    }

    /**
     * Get TT statistics
     */
    getTranspositionTableStats() {
        return this.transpositionTable?.getStats() || null;
    }

    /**
     * Cleanup workers and resources
     */
    cleanup() {
        this.workers.forEach((workerState) => {
            if (workerState.worker) {
                workerState.worker.terminate();
            }
        });
        this.workers = [];
        this.isInitialized = false;
        this.initializationPromise = null;
        console.log('🧹 WorkerManager cleaned up');
    }
}

// Singleton instance
const workerManager = new WorkerManager();

export default workerManager;
