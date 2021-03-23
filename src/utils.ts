export function formatBytes(bytes: number) {
    if (bytes < 1024) {
        return `${bytes} b`;

    } else if (bytes < Math.pow(1024, 2)) {
        return `${(bytes / 1024).toFixed(2)} kb`;

    } else if (bytes < Math.pow(1024, 4)) {
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    }
}

export function elapsedTime(inputSeconds: number) {
    const days = Math.floor(inputSeconds / (60 * 60 * 24));
    const hours = Math.floor((inputSeconds % (60 * 60 * 24)) / (60 * 60));
    const minutes = Math.floor(((inputSeconds % (60 * 60 * 24)) % (60 * 60)) / 60);
    const seconds = Math.floor(((inputSeconds % (60 * 60 * 24)) % (60 * 60)) % 60);

    let ddhhmmss = '';

    if (days > 0) { ddhhmmss += days + ' day '; }
    if (hours > 0) { ddhhmmss += hours + ' hour '; }
    if (minutes > 0) { ddhhmmss += minutes + ' minutes '; }
    if (seconds > 0) { ddhhmmss += seconds + ' seconds '; }

    return ddhhmmss || "...";
}

export function debounce<T extends Function>(cb: T, wait = 100) {
    let h: any = 0;
    let callable = (...args: any) => {
        clearTimeout(h);
        h = setTimeout(() => cb(...args), wait);
    };
    return <T>(<any>callable);
}

export function throttle<F extends (...args: any[]) => any>(func: F, waitFor: number) {
    const now = () => new Date().getTime()
    const resetStartTime = () => startTime = now()
    let timeout: any;
    let startTime: number = now() - waitFor;

    return (...args: Parameters<F>): Promise<ReturnType<F>> =>
        new Promise((resolve) => {
            const timeLeft = (startTime + waitFor) - now()
            if (timeout) {
                clearTimeout(timeout)
            }
            if (startTime + waitFor <= now()) {
                resetStartTime()
                resolve(func(...args))
            } else {
                timeout = setTimeout(() => {
                    resetStartTime()
                    resolve(func(...args))
                }, timeLeft)
            }
        })
}