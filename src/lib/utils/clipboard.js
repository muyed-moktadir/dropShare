/**
 * Universal clipboard copy utility with fallback for non-secure HTTP LAN IP contexts.
 * Modern browsers disable `navigator.clipboard` on plain HTTP (e.g. http://192.168.x.x:3000).
 */
export async function copyToClipboard(text) {
    if (typeof window === 'undefined')
        return false;
    // 1. Modern Clipboard API (available on localhost and HTTPS)
    if (navigator?.clipboard && typeof navigator.clipboard.writeText === 'function') {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        }
        catch {
            // Fallback if blocked by user permissions
        }
    }
    // 2. Fallback for HTTP LAN IPs (e.g. http://192.168.0.107:3000)
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '-999999px';
        textarea.setAttribute('readonly', '');
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const successful = document.execCommand('copy');
        document.body.removeChild(textarea);
        return successful;
    }
    catch (err) {
        console.warn('[DropSphere Clipboard] Copy fallback failed:', err);
        return false;
    }
}
