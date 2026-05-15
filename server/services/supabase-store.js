const { supabase } = require('../db/connection');
const archiver = require('archiver');
const unzipper = require('unzipper');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

/**
 * SupabaseSessionStore
 * Implements the store interface for whatsapp-web.js RemoteAuth
 */
class SupabaseSessionStore {
    constructor(bucketName = 'whatsapp-sessions') {
        this.bucketName = bucketName;
    }

    async sessionExists(options) {
        try {
            const { data, error } = await supabase.storage
                .from(this.bucketName)
                .list('', { search: `${options.session}.zip` });

            if (error) return false;
            return data && data.length > 0;
        } catch (err) {
            return false;
        }
    }

    async save(options) {
        return new Promise((resolve, reject) => {
            const archiveFunc = typeof archiver === 'function' ? archiver : archiver.default;
            const archive = archiveFunc('zip');
            const sessionPath = options.path;
            
            // Create a buffer to store the zip
            const chunks = [];
            archive.on('data', (chunk) => chunks.push(chunk));
            archive.on('end', async () => {
                const buffer = Buffer.concat(chunks);
                try {
                    const { error } = await supabase.storage
                        .from(this.bucketName)
                        .upload(`${options.session}.zip`, buffer, {
                            upsert: true,
                            contentType: 'application/zip'
                        });
                    
                    if (error) throw error;
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });

            archive.on('error', (err) => reject(err));
            
            // Fix: If path is missing or undefined, try to resolve it from the session name
            const actualPath = sessionPath || path.resolve('./.wwebjs_auth', `session-${options.session}`);
            
            if (fs.existsSync(actualPath)) {
                console.log(`[SupabaseStore] Archiving session from: ${actualPath}`);
                archive.directory(actualPath, false);
                archive.finalize();
            } else {
                console.warn(`[SupabaseStore] Session path ${actualPath} not found. Searching for any session folder...`);
                // Fallback: search for any folder starting with 'session-' in .wwebjs_auth
                const base = path.resolve('./.wwebjs_auth');
                if (fs.existsSync(base)) {
                    const dirs = fs.readdirSync(base).filter(f => f.startsWith('session-'));
                    if (dirs.length > 0) {
                        const fallbackPath = path.join(base, dirs[0]);
                        console.log(`[SupabaseStore] Falling back to: ${fallbackPath}`);
                        archive.directory(fallbackPath, false);
                        archive.finalize();
                        return;
                    }
                }
                reject(new Error(`Session path ${actualPath} could not be resolved.`));
            }
        });
    }

    async extract(options) {
        try {
            const { data, error } = await supabase.storage
                .from(this.bucketName)
                .download(`${options.session}.zip`);

            if (error) throw error;

            const buffer = await data.arrayBuffer();
            const stream = Readable.from(Buffer.from(buffer));
            
            await stream.pipe(unzipper.Extract({ path: options.path })).promise();
        } catch (err) {
            console.error('[SupabaseStore] Extract error:', err.message);
            throw err;
        }
    }

    async delete(options) {
        try {
            await supabase.storage
                .from(this.bucketName)
                .remove([`${options.session}.zip`]);
        } catch (err) {
            console.error('[SupabaseStore] Delete error:', err.message);
        }
    }
}

module.exports = SupabaseSessionStore;
