/**
 * Optimized Utilities Module for Office Supply Management System
 * Contains performance optimizations, lazy loading, and caching mechanisms
 */

class PerformanceUtils {
    constructor() {
        this.imageCache = new Map();
        this.debounceTimers = new Map();
        this.intersectionObserver = null;
        this.lazyImages = new Set();
        this.virtualScrollCache = new Map();
        this.renderQueue = [];
        this.isProcessingQueue = false;
    }

    /**
     * Debounce function calls to improve performance
     */
    debounce(func, wait, key = 'default') {
        return (...args) => {
            if (this.debounceTimers.has(key)) {
                clearTimeout(this.debounceTimers.get(key));
            }
            
            const timer = setTimeout(() => {
                this.debounceTimers.delete(key);
                func.apply(this, args);
            }, wait);
            
            this.debounceTimers.set(key, timer);
        };
    }

    /**
     * Throttle function calls
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Lazy loading for images
     */
    initLazyLoading() {
        if (!this.intersectionObserver) {
            this.intersectionObserver = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            this.loadImage(img);
                            this.intersectionObserver.unobserve(img);
                        }
                    });
                },
                { rootMargin: '50px' }
            );
        }
    }

    /**
     * Add image to lazy loading queue
     */
    addLazyImage(img) {
        if (!this.intersectionObserver) {
            this.initLazyLoading();
        }
        
        this.lazyImages.add(img);
        this.intersectionObserver.observe(img);
    }

    /**
     * Load image with caching
     */
    async loadImage(img) {
        const src = img.dataset.src || img.src;
        
        if (this.imageCache.has(src)) {
            img.src = this.imageCache.get(src);
            img.classList.add('loaded');
            return;
        }

        try {
            const imageUrl = await this.optimizeImage(src);
            this.imageCache.set(src, imageUrl);
            img.src = imageUrl;
            img.classList.add('loaded');
        } catch (error) {
            console.warn('Failed to load image:', src, error);
            img.classList.add('error');
        }
    }

    /**
     * Optimize images before loading
     */
    async optimizeImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                // Create canvas for image optimization
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate optimal size (max 800px width)
                const maxWidth = 800;
                const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
                
                canvas.width = img.width * ratio;
                canvas.height = img.height * ratio;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                // Convert to optimized blob
                canvas.toBlob(
                    (blob) => {
                        const url = URL.createObjectURL(blob);
                        resolve(url);
                    },
                    'image/jpeg',
                    0.8 // 80% quality
                );
            };
            img.onerror = reject;
            img.src = src;
        });
    }

    /**
     * Virtual scrolling for large lists
     */
    initVirtualScroll(container, items, renderItem, itemHeight = 100) {
        const viewport = {
            height: container.clientHeight,
            scrollTop: 0
        };

        const virtualList = {
            totalItems: items.length,
            itemHeight,
            visibleStart: 0,
            visibleEnd: 0,
            buffer: 5 // Extra items to render outside viewport
        };

        // Calculate visible range
        const updateVisibleRange = () => {
            const start = Math.floor(viewport.scrollTop / virtualList.itemHeight);
            const end = Math.min(
                start + Math.ceil(viewport.height / virtualList.itemHeight),
                virtualList.totalItems
            );

            virtualList.visibleStart = Math.max(0, start - virtualList.buffer);
            virtualList.visibleEnd = Math.min(virtualList.totalItems, end + virtualList.buffer);
        };

        // Render visible items
        const renderVisibleItems = this.throttle(() => {
            updateVisibleRange();
            
            const fragment = document.createDocumentFragment();
            const spacerTop = document.createElement('div');
            const spacerBottom = document.createElement('div');
            
            spacerTop.style.height = `${virtualList.visibleStart * virtualList.itemHeight}px`;
            spacerBottom.style.height = `${(virtualList.totalItems - virtualList.visibleEnd) * virtualList.itemHeight}px`;
            
            fragment.appendChild(spacerTop);
            
            for (let i = virtualList.visibleStart; i < virtualList.visibleEnd; i++) {
                const itemElement = renderItem(items[i], i);
                itemElement.style.height = `${virtualList.itemHeight}px`;
                fragment.appendChild(itemElement);
            }
            
            fragment.appendChild(spacerBottom);
            
            // Replace container content
            container.innerHTML = '';
            container.appendChild(fragment);
        }, 16); // ~60fps

        // Set up scroll listener
        container.addEventListener('scroll', (e) => {
            viewport.scrollTop = e.target.scrollTop;
            renderVisibleItems();
        });

        // Initial render
        renderVisibleItems();

        return {
            update: (newItems) => {
                items = newItems;
                virtualList.totalItems = items.length;
                renderVisibleItems();
            },
            scrollToIndex: (index) => {
                container.scrollTop = index * virtualList.itemHeight;
            }
        };
    }

    /**
     * Batch DOM operations for better performance
     */
    batchDOMOperations(operations) {
        return new Promise((resolve) => {
            this.renderQueue.push(...operations);
            
            if (!this.isProcessingQueue) {
                this.processRenderQueue().then(resolve);
            }
        });
    }

    async processRenderQueue() {
        this.isProcessingQueue = true;
        
        const batch = this.renderQueue.splice(0, 10); // Process 10 operations at a time
        
        for (const operation of batch) {
            await this.executeOperation(operation);
        }
        
        if (this.renderQueue.length > 0) {
            // Continue processing in next frame
            requestAnimationFrame(() => this.processRenderQueue());
        } else {
            this.isProcessingQueue = false;
        }
    }

    executeOperation(operation) {
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                operation();
                resolve();
            });
        });
    }

    /**
     * Memoization for expensive calculations
     */
    memoize(fn, getKey = (...args) => JSON.stringify(args)) {
        const cache = new Map();
        
        return (...args) => {
            const key = getKey(...args);
            
            if (cache.has(key)) {
                return cache.get(key);
            }
            
            const result = fn(...args);
            cache.set(key, result);
            
            // Limit cache size
            if (cache.size > 100) {
                const firstKey = cache.keys().next().value;
                cache.delete(firstKey);
            }
            
            return result;
        };
    }

    /**
     * Optimized event delegation
     */
    delegate(parent, selector, event, handler) {
        parent.addEventListener(event, (e) => {
            const target = e.target.closest(selector);
            if (target && parent.contains(target)) {
                handler.call(target, e);
            }
        });
    }

    /**
     * Performance monitoring
     */
    measurePerformance(name, fn) {
        return async (...args) => {
            const start = performance.now();
            const result = await fn(...args);
            const end = performance.now();
            
            console.log(`${name} took ${end - start} milliseconds`);
            return result;
        };
    }

    /**
     * Memory usage monitoring
     */
    getMemoryUsage() {
        if (performance.memory) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
                total: Math.round(performance.memory.totalJSHeapSize / 1048576), // MB
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) // MB
            };
        }
        return null;
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Clear timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        
        // Disconnect observers
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        
        // Clear caches
        this.imageCache.clear();
        this.virtualScrollCache.clear();
        this.lazyImages.clear();
        
        // Revoke blob URLs
        this.imageCache.forEach(url => {
            if (url.startsWith('blob:')) {
                URL.revokeObjectURL(url);
            }
        });
    }
}

/**
 * Image utilities with optimization
 */
class ImageUtils {
    static async compressImage(file, quality = 0.8, maxWidth = 1024) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // Calculate dimensions
                const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
                canvas.width = img.width * ratio;
                canvas.height = img.height * ratio;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }

    static async resizeImage(file, width, height) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                canvas.width = width;
                canvas.height = height;
                
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(resolve, 'image/jpeg', 0.8);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }

    static async createThumbnail(file, size = 150) {
        return this.resizeImage(file, size, size);
    }
}

/**
 * Form utilities with validation
 */
class FormUtils {
    static validateForm(form, rules) {
        const errors = {};
        const formData = new FormData(form);
        
        for (const [field, rule] of Object.entries(rules)) {
            const value = formData.get(field);
            
            if (rule.required && (!value || value.trim() === '')) {
                errors[field] = 'ฟิลด์นี้จำเป็นต้องระบุ';
                continue;
            }
            
            if (value && rule.pattern && !rule.pattern.test(value)) {
                errors[field] = rule.message || 'รูปแบบไม่ถูกต้อง';
            }
            
            if (value && rule.min && value.length < rule.min) {
                errors[field] = `ต้องมีอย่างน้อย ${rule.min} ตัวอักษร`;
            }
            
            if (value && rule.max && value.length > rule.max) {
                errors[field] = `ต้องไม่เกิน ${rule.max} ตัวอักษร`;
            }
        }
        
        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }

    static showFormErrors(form, errors) {
        // Clear previous errors
        form.querySelectorAll('.error-message').forEach(el => el.remove());
        form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
        
        // Show new errors
        for (const [field, message] of Object.entries(errors)) {
            const input = form.querySelector(`[name="${field}"]`);
            if (input) {
                input.classList.add('error');
                
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.textContent = message;
                
                input.parentNode.appendChild(errorDiv);
            }
        }
    }
}

/**
 * Date utilities
 */
class DateUtils {
    static formatThaiDate(date) {
        return new Intl.DateTimeFormat('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(new Date(date));
    }

    static getRelativeTime(date) {
        const now = new Date();
        const diff = now - new Date(date);
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) return 'วันนี้';
        if (days === 1) return 'เมื่อวาน';
        if (days < 7) return `${days} วันที่แล้ว`;
        if (days < 30) return `${Math.floor(days / 7)} สัปดาห์ที่แล้ว`;
        if (days < 365) return `${Math.floor(days / 30)} เดือนที่แล้ว`;
        return `${Math.floor(days / 365)} ปีที่แล้ว`;
    }
}

/**
 * Export/Import utilities
 */
class DataUtils {
    static async exportToJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], {
            type: 'application/json'
        });
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    static async exportToCSV(data, filename, headers) {
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    static async importFromJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    resolve(data);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }
}

class LogUtils {
    static API_BASE_URL = './api/';
    
    /**
     * บันทึกการเปลี่ยนแปลงในระบบ
     */
    static async logActivity(action, tableName, recordId = null, oldData = null, newData = null, userId = null) {
        try {
            // ตรวจสอบว่ามี LogUtils หรือไม่
            if (typeof window.LogUtils === 'undefined') {
                console.warn('LogUtils not available');
                return;
            }
            
            const logData = {
                action: action,
                table_name: tableName,
                record_id: recordId,
                old_data: oldData,
                new_data: newData,
                user_id: userId
            };
            
            const response = await fetch(this.API_BASE_URL + 'logs.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(logData)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Log entry created:', result);
            return result;
        } catch (error) {
            console.error('Failed to log activity:', error);
            // ไม่ throw error เพื่อไม่ให้กระทบการทำงานหลัก
            return null;
        }
    }
    
    /**
     * ดึงข้อมูล logs พร้อม filter และ pagination
     */
    static async getLogs(filters = {}) {
        try {
            const params = new URLSearchParams();
            
            if (filters.page) params.append('page', filters.page);
            if (filters.limit) params.append('limit', filters.limit);
            if (filters.action) params.append('action', filters.action);
            if (filters.table_name) params.append('table_name', filters.table_name);
            if (filters.date_from) params.append('date_from', filters.date_from);
            if (filters.date_to) params.append('date_to', filters.date_to);
            
            const response = await fetch(this.API_BASE_URL + 'logs.php?' + params.toString(), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Failed to get logs:', error);
            throw error;
        }
    }
    
    /**
     * ลบ logs เก่า
     */
    static async clearOldLogs(days = 30) {
        try {
            const response = await fetch(this.API_BASE_URL + 'logs.php?days=' + days, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Old logs cleared:', result);
            return result;
        } catch (error) {
            console.error('Failed to clear old logs:', error);
            throw error;
        }
    }
    
    /**
     * แปลง action เป็นข้อความภาษาไทย
     */
    static getActionText(action) {
        const actionMap = {
            'create': 'สร้าง',
            'update': 'แก้ไข',
            'delete': 'ลบ',
            'login': 'เข้าสู่ระบบ',
            'logout': 'ออกจากระบบ',
            'export': 'ส่งออกข้อมูล',
            'import': 'นำเข้าข้อมูล',
            'sync': 'ซิงค์ข้อมูล',
            'backup': 'สำรองข้อมูล',
            'restore': 'กู้คืนข้อมูล'
        };
        
        return actionMap[action] || action;
    }
    
    /**
     * แปลง table name เป็นข้อความภาษาไทย
     */
    static getTableText(tableName) {
        const tableMap = {
            'items': 'สินค้า',
            'bags': 'กระเป๋า',
            'events': 'อีเวนต์',
            'returns': 'การคืนสินค้า',
            'users': 'ผู้ใช้',
            'activity_logs': 'บันทึกกิจกรรม'
        };
        
        return tableMap[tableName] || tableName;
    }
    
    /**
     * จัดรูปแบบข้อมูลสำหรับแสดงผล
     */
    static formatLogData(log) {
        return {
            ...log,
            action_text: this.getActionText(log.action),
            table_text: this.getTableText(log.table_name),
            formatted_date: new Date(log.created_at).toLocaleString('th-TH'),
            old_data_parsed: log.old_data ? JSON.parse(log.old_data) : null,
            new_data_parsed: log.new_data ? JSON.parse(log.new_data) : null
        };
    }
}

// Create global utility instances
const performanceUtils = new PerformanceUtils();

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    performanceUtils.cleanup();
});

// Export utilities
window.PerformanceUtils = PerformanceUtils;
window.ImageUtils = ImageUtils;
window.FormUtils = FormUtils;
window.DateUtils = DateUtils;
window.DataUtils = DataUtils;
window.LogUtils = LogUtils;
window.performanceUtils = performanceUtils; 