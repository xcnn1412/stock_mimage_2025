// 🛠️ Local Database Setup Script
// ใช้สำหรับตั้งค่าฐานข้อมูล local เพื่อทดสอบ

class LocalDatabaseSetup {
    constructor() {
        this.dbName = 'OfficeSupplyTestDB';
        this.version = 1;
        this.db = null;
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ Local Database เชื่อมต่อสำเร็จ');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // สร้าง Object Stores (ตาราง)
                this.createItemsStore(db);
                this.createBagsStore(db);
                this.createEventsStore(db);
                
                console.log('🏗️ Local Database สร้างโครงสร้างเสร็จสิ้น');
            };
        });
    }

    createItemsStore(db) {
        if (!db.objectStoreNames.contains('items')) {
            const itemsStore = db.createObjectStore('items', { keyPath: 'id' });
            itemsStore.createIndex('status', 'status');
            itemsStore.createIndex('bagId', 'bagId');
            itemsStore.createIndex('purchaseDate', 'purchaseDate');
        }
    }

    createBagsStore(db) {
        if (!db.objectStoreNames.contains('bags')) {
            const bagsStore = db.createObjectStore('bags', { keyPath: 'id' });
            bagsStore.createIndex('status', 'status');
            bagsStore.createIndex('responsible', 'responsible');
        }
    }

    createEventsStore(db) {
        if (!db.objectStoreNames.contains('events')) {
            const eventsStore = db.createObjectStore('events', { keyPath: 'id' });
            eventsStore.createIndex('status', 'status');
            eventsStore.createIndex('date', 'date');
        }
    }

    // นำข้อมูลจาก localStorage มาใส่ใน IndexedDB
    async migrateFromLocalStorage() {
        try {
            console.log('🔄 กำลัง migrate ข้อมูลจาก localStorage...');
            
            const items = JSON.parse(localStorage.getItem('office-items') || '[]');
            const bags = JSON.parse(localStorage.getItem('office-bags') || '[]');
            const events = JSON.parse(localStorage.getItem('office-events') || '[]');

            if (items.length > 0) {
                await this.bulkInsert('items', items);
                console.log(`✅ Migrate สินค้า ${items.length} รายการ`);
            }

            if (bags.length > 0) {
                await this.bulkInsert('bags', bags);
                console.log(`✅ Migrate กระเป๋า ${bags.length} รายการ`);
            }

            if (events.length > 0) {
                await this.bulkInsert('events', events);
                console.log(`✅ Migrate อีเวนต์ ${events.length} รายการ`);
            }

            return true;
        } catch (error) {
            console.error('❌ Migration ล้มเหลว:', error);
            return false;
        }
    }

    // เพิ่มข้อมูลหลายรายการพร้อมกัน
    async bulkInsert(storeName, dataArray) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            let completed = 0;
            
            dataArray.forEach(item => {
                const request = store.put(item);
                request.onsuccess = () => {
                    completed++;
                    if (completed === dataArray.length) {
                        resolve();
                    }
                };
                request.onerror = () => reject(request.error);
            });
            
            if (dataArray.length === 0) resolve();
        });
    }

    // ดึงข้อมูลทั้งหมดจาก store
    async getAllData(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ล้างข้อมูลใน store
    async clearStore(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // สร้างข้อมูลตัวอย่างสำหรับทดสอบ
    async createSampleData() {
        const sampleItems = [
            {
                id: 'item1_' + Date.now(),
                name: 'กล้อง DSLR Canon',
                purchaseDate: '2024-01-15',
                price: 25000,
                status: 'available',
                bagId: null,
                receiptPhoto: null,
                itemPhoto: null
            },
            {
                id: 'item2_' + Date.now(),
                name: 'ไมค์ไร้สาย Shure',
                purchaseDate: '2024-01-20',
                price: 8500,
                status: 'available',
                bagId: null,
                receiptPhoto: null,
                itemPhoto: null
            }
        ];

        const sampleBags = [
            {
                id: 'bag1_' + Date.now(),
                name: 'กระเป๋าถ่ายภาพ',
                responsible: 'ช่างภาพ A',
                status: 'available',
                items: [],
                createdAt: new Date().toISOString()
            }
        ];

        const sampleEvents = [
            {
                id: 'event1_' + Date.now(),
                name: 'งานแต่งงาน คุณสมชาย',
                date: '2024-02-14',
                time: '10:00',
                location: 'โรงแรม ABC',
                customer: 'คุณสมชาย',
                responsible: 'ทีมงาน A',
                status: 'active',
                bags: []
            }
        ];

        try {
            await this.bulkInsert('items', sampleItems);
            await this.bulkInsert('bags', sampleBags);
            await this.bulkInsert('events', sampleEvents);
            
            console.log('✅ สร้างข้อมูลตัวอย่างเสร็จสิ้น');
            return true;
        } catch (error) {
            console.error('❌ สร้างข้อมูลตัวอย่างล้มเหลว:', error);
            return false;
        }
    }

    // ตรวจสอบสถานะฐานข้อมูล
    async getDatabaseStats() {
        try {
            const items = await this.getAllData('items');
            const bags = await this.getAllData('bags');
            const events = await this.getAllData('events');
            
            return {
                items: items.length,
                bags: bags.length,
                events: events.length,
                total: items.length + bags.length + events.length
            };
        } catch (error) {
            console.error('❌ ไม่สามารถดึงสถิติฐานข้อมูล:', error);
            return { items: 0, bags: 0, events: 0, total: 0 };
        }
    }

    // Export ข้อมูลเป็น JSON
    async exportToJSON() {
        try {
            const items = await this.getAllData('items');
            const bags = await this.getAllData('bags');
            const events = await this.getAllData('events');
            
            return {
                items,
                bags,
                events,
                exportDate: new Date().toISOString(),
                version: '1.0'
            };
        } catch (error) {
            console.error('❌ Export ข้อมูลล้มเหลว:', error);
            return null;
        }
    }

    // Import ข้อมูลจาก JSON
    async importFromJSON(jsonData) {
        try {
            // ล้างข้อมูลเดิม
            await this.clearStore('items');
            await this.clearStore('bags');
            await this.clearStore('events');
            
            // นำเข้าข้อมูลใหม่
            if (jsonData.items) {
                await this.bulkInsert('items', jsonData.items);
            }
            
            if (jsonData.bags) {
                await this.bulkInsert('bags', jsonData.bags);
            }
            
            if (jsonData.events) {
                await this.bulkInsert('events', jsonData.events);
            }
            
            console.log('✅ Import ข้อมูลสำเร็จ');
            return true;
        } catch (error) {
            console.error('❌ Import ข้อมูลล้มเหลว:', error);
            return false;
        }
    }
}

// สร้าง instance สำหรับใช้งาน
const localDB = new LocalDatabaseSetup();

// ฟังก์ชันสำหรับใช้งานใน console
window.setupLocalDatabase = async function() {
    try {
        await localDB.initialize();
        const stats = await localDB.getDatabaseStats();
        
        console.log('📊 สถิติฐานข้อมูล Local:');
        console.log(`   สินค้า: ${stats.items} รายการ`);
        console.log(`   กระเป๋า: ${stats.bags} รายการ`);
        console.log(`   อีเวนต์: ${stats.events} รายการ`);
        console.log(`   รวม: ${stats.total} รายการ`);
        
        return localDB;
    } catch (error) {
        console.error('❌ ตั้งค่าฐานข้อมูล Local ล้มเหลว:', error);
        return null;
    }
};

window.migrateData = async function() {
    if (!localDB.db) {
        console.log('⚠️ กรุณารัน setupLocalDatabase() ก่อน');
        return;
    }
    
    return await localDB.migrateFromLocalStorage();
};

window.createSampleData = async function() {
    if (!localDB.db) {
        console.log('⚠️ กรุณารัน setupLocalDatabase() ก่อน');
        return;
    }
    
    return await localDB.createSampleData();
};

window.exportLocalData = async function() {
    if (!localDB.db) {
        console.log('⚠️ กรุณารัน setupLocalDatabase() ก่อน');
        return;
    }
    
    const data = await localDB.exportToJSON();
    
    if (data) {
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `local-database-export-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        console.log('📤 Export ข้อมูล Local สำเร็จ');
    }
};

// Export class สำหรับใช้งานใน module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LocalDatabaseSetup;
}