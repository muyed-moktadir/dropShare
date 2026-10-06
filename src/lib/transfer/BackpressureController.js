export class BackpressureController {
    dataChannel;
    maxBufferSize;
    lowThreshold;
    waitPromise = null;
    resumeResolve = null;
    isAborted = false;
    originalLowThreshold;
    constructor(dataChannel, maxBufferSize = 4 * 1024 * 1024, // 4 MB ceiling
    lowThreshold = 1024 * 1024 // 1 MB floor
    ) {
        this.dataChannel = dataChannel;
        this.maxBufferSize = maxBufferSize;
        this.lowThreshold = lowThreshold;
        this.originalLowThreshold = this.dataChannel.bufferedAmountLowThreshold;
        this.dataChannel.bufferedAmountLowThreshold = this.lowThreshold;
        this.dataChannel.onbufferedamountlow = () => {
            if (this.resumeResolve) {
                const resolve = this.resumeResolve;
                this.resumeResolve = null;
                this.waitPromise = null;
                resolve();
            }
        };
    }
    /**
     * Sends binary buffer through data channel with automatic backpressure throttling
     */
    async send(buffer) {
        if (this.isAborted) {
            throw new Error('Transfer aborted');
        }
        if (this.dataChannel.readyState !== 'open') {
            throw new Error(`DataChannel state is '${this.dataChannel.readyState}', expected 'open'`);
        }
        // If buffer exceeds high water mark (4MB), wait until onbufferedamountlow fires (1MB floor)
        if (this.dataChannel.bufferedAmount > this.maxBufferSize) {
            if (!this.waitPromise) {
                this.waitPromise = new Promise((resolve) => {
                    this.resumeResolve = resolve;
                });
            }
            await this.waitPromise;
        }
        if (this.isAborted) {
            throw new Error('Transfer aborted');
        }
        if (this.dataChannel.readyState !== 'open') {
            throw new Error('DataChannel closed during transfer');
        }
        this.dataChannel.send(buffer);
    }
    /**
     * Cancel and unblock pending waits
     */
    abort() {
        this.isAborted = true;
        if (this.resumeResolve) {
            const resolve = this.resumeResolve;
            this.resumeResolve = null;
            this.waitPromise = null;
            resolve();
        }
    }
    getBufferedAmount() {
        return this.dataChannel.bufferedAmount;
    }
}
