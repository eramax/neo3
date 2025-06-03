// Storage providers for data persistence
export class StorageProvider {
    static providerName = 'unknown';

    save(key, data) {
        throw new Error('save method must be implemented');
    }

    load(key, fallback = null) {
        throw new Error('load method must be implemented');
    }

    remove(key) {
        throw new Error('remove method must be implemented');
    }

    static getProviders() {
        return {
            localStorage: LocalStorageProvider
        };
    }
}

export class LocalStorageProvider extends StorageProvider {
    static providerName = 'localStorage';

    save(key, data) {
        try {
            localStorage.setItem(`neo3_${key}`, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
            return false;
        }
    }

    load(key, fallback = null) {
        try {
            const data = localStorage.getItem(`neo3_${key}`);
            return data ? JSON.parse(data) : fallback;
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            return fallback;
        }
    }

    remove(key) {
        try {
            localStorage.removeItem(`neo3_${key}`);
            return true;
        } catch (error) {
            console.error('Failed to remove from localStorage:', error);
            return false;
        }
    }
}

export const StorageFactory = {
    localStorage: LocalStorageProvider
};
