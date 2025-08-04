/**
 * IndexedDB Database Manager for Office Supply Management System
 * Provides better performance and reliability than localStorage
 */

class OfficeSupplyDB {
    constructor() {
        this.dbName = 'OfficeSupplyDB';
        this.version = 1;
        this.db = null;
        this.isReady = false;
        this.cache = new Map();
        this.listeners = new Map();
    }

    /**
     * Initialize the database
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('Database failed to open');
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isReady = true;
                console.log('Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (e) => {
                this.db = e.target.result;
                
                // Create object stores
                if (!this.db.objectStoreNames.contains('items')) {
                    const itemStore = this.db.createObjectStore('items', { keyPath: 'id' });
                    itemStore.createIndex('status', 'status', { unique: false });
                    itemStore.createIndex('bagId', 'bagId', { unique: false });
                    itemStore.createIndex('name', 'name', { unique: false });
                }

                if (!this.db.objectStoreNames.contains('bags')) {
                    const bagStore = this.db.createObjectStore('bags', { keyPath: 'id' });
                    bagStore.createIndex('status', 'status', { unique: false });
                    bagStore.createIndex('responsible', 'responsible', { unique: false });
                }

                if (!this.db.objectStoreNames.contains('events')) {
                    const eventStore = this.db.createObjectStore('events', { keyPath: 'id' });
                    eventStore.createIndex('status', 'status', { unique: false });
                    eventStore.createIndex('date', 'date', { unique: false });
                    eventStore.createIndex('customer', 'customer', { unique: false });
                }

                // Create settings store for app configuration
                if (!this.db.objectStoreNames.contains('settings')) {
                    this.db.createObjectStore('settings', { keyPath: 'key' });
                }

                console.log('Database setup complete');
            };
        });
    }

    /**
     * Generic method to add/update data
     */
    async put(storeName, data) {
        if (!this.isReady) await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => {
                // Update cache
                this.updateCache(storeName, data);
                // Notify listeners
                this.notifyListeners(storeName, 'put', data);
                resolve(request.result);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Generic method to get data by ID
     */
    async get(storeName, id) {
        if (!this.isReady) await this.init();

        // Check cache first
        const cacheKey = `${storeName}_${id}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);

            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    this.updateCache(storeName, result);
                }
                resolve(result);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all data from a store
     */
    async getAll(storeName) {
        if (!this.isReady) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                const results = request.result;
                // Update cache for all items
                results.forEach(item => this.updateCache(storeName, item));
                resolve(results);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete data by ID
     */
    async delete(storeName, id) {
        if (!this.isReady) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);

            request.onsuccess = () => {
                // Remove from cache
                this.removeFromCache(storeName, id);
                // Notify listeners
                this.notifyListeners(storeName, 'delete', { id });
                resolve(request.result);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Query data using index
     */
    async queryByIndex(storeName, indexName, value) {
        if (!this.isReady) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Count records in a store
     */
    async count(storeName) {
        if (!this.isReady) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Bulk operations for better performance
     */
    async bulkPut(storeName, dataArray) {
        if (!this.isReady) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            let completed = 0;
            const total = dataArray.length;

            transaction.oncomplete = () => {
                // Update cache for all items
                dataArray.forEach(item => this.updateCache(storeName, item));
                resolve(completed);
            };

            transaction.onerror = () => reject(transaction.error);

            dataArray.forEach(data => {
                const request = store.put(data);
                request.onsuccess = () => {
                    completed++;
                };
            });
        });
    }

    /**
     * Search functionality with pagination
     */
    async search(storeName, searchTerm, options = {}) {
        if (!this.isReady) await this.init();

        const { limit = 50, offset = 0, fields = [] } = options;
        const allData = await this.getAll(storeName);
        
        const filtered = allData.filter(item => {
            if (fields.length === 0) {
                // Search in all string fields
                return Object.values(item).some(value => 
                    typeof value === 'string' && 
                    value.toLowerCase().includes(searchTerm.toLowerCase())
                );
            } else {
                // Search in specific fields
                return fields.some(field => 
                    item[field] && 
                    typeof item[field] === 'string' && 
                    item[field].toLowerCase().includes(searchTerm.toLowerCase())
                );
            }
        });

        return {
            data: filtered.slice(offset, offset + limit),
            total: filtered.length,
            hasMore: offset + limit < filtered.length
        };
    }

    /**
     * Export data to JSON
     */
    async exportData() {
        const items = await this.getAll('items');
        const bags = await this.getAll('bags');
        const events = await this.getAll('events');
        const settings = await this.getAll('settings');

        return {
            items,
            bags,
            events,
            settings,
            exportDate: new Date().toISOString(),
            version: this.version
        };
    }

    /**
     * Import data from JSON
     */
    async importData(data) {
        if (!this.isReady) await this.init();

        try {
            await this.bulkPut('items', data.items || []);
            await this.bulkPut('bags', data.bags || []);
            await this.bulkPut('events', data.events || []);
            await this.bulkPut('settings', data.settings || []);
            
            // Clear cache to force refresh
            this.cache.clear();
            
            return true;
        } catch (error) {
            console.error('Import failed:', error);
            return false;
        }
    }

    /**
     * Clear all data
     */
    async clearAll() {
        if (!this.isReady) await this.init();

        const storeNames = ['items', 'bags', 'events', 'settings'];
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeNames, 'readwrite');
            
            transaction.oncomplete = () => {
                this.cache.clear();
                resolve();
            };
            
            transaction.onerror = () => reject(transaction.error);

            storeNames.forEach(storeName => {
                transaction.objectStore(storeName).clear();
            });
        });
    }

    /**
     * Cache management
     */
    updateCache(storeName, data) {
        const cacheKey = `${storeName}_${data.id}`;
        this.cache.set(cacheKey, data);
        
        // Limit cache size (keep last 1000 items)
        if (this.cache.size > 1000) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }

    removeFromCache(storeName, id) {
        const cacheKey = `${storeName}_${id}`;
        this.cache.delete(cacheKey);
    }

    clearCache() {
        this.cache.clear();
    }

    /**
     * Event listeners for real-time updates
     */
    addEventListener(storeName, callback) {
        if (!this.listeners.has(storeName)) {
            this.listeners.set(storeName, []);
        }
        this.listeners.get(storeName).push(callback);
    }

    removeEventListener(storeName, callback) {
        if (this.listeners.has(storeName)) {
            const listeners = this.listeners.get(storeName);
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    notifyListeners(storeName, operation, data) {
        if (this.listeners.has(storeName)) {
            this.listeners.get(storeName).forEach(callback => {
                try {
                    callback(operation, data);
                } catch (error) {
                    console.error('Listener error:', error);
                }
            });
        }
    }

    /**
     * Database statistics
     */
    async getStats() {
        const itemCount = await this.count('items');
        const bagCount = await this.count('bags');
        const eventCount = await this.count('events');

        return {
            items: itemCount,
            bags: bagCount,
            events: eventCount,
            cacheSize: this.cache.size,
            dbSize: await this.getDbSize()
        };
    }

    async getDbSize() {
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            return estimate.usage;
        }
        return 'Unknown';
    }

    /**
     * Migrate from localStorage
     */
    async migrateFromLocalStorage() {
        try {
            const oldItems = JSON.parse(localStorage.getItem('office-items') || '[]');
            const oldBags = JSON.parse(localStorage.getItem('office-bags') || '[]');
            const oldEvents = JSON.parse(localStorage.getItem('office-events') || '[]');

            if (oldItems.length > 0) {
                await this.bulkPut('items', oldItems);
                console.log(`Migrated ${oldItems.length} items`);
            }

            if (oldBags.length > 0) {
                await this.bulkPut('bags', oldBags);
                console.log(`Migrated ${oldBags.length} bags`);
            }

            if (oldEvents.length > 0) {
                await this.bulkPut('events', oldEvents);
                console.log(`Migrated ${oldEvents.length} events`);
            }

            // Clean up localStorage
            localStorage.removeItem('office-items');
            localStorage.removeItem('office-bags');
            localStorage.removeItem('office-events');

            return true;
        } catch (error) {
            console.error('Migration failed:', error);
            return false;
        }
    }
}

// Create global database instance
const db = new OfficeSupplyDB();

// Export for use in other modules
if (typeof db === 'undefined') {
    // fallback to localStorage
} 