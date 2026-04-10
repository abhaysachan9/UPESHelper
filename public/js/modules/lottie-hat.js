/**
 * public/js/modules/lottie-hat.js
 * Utility for loading the graduation-hat Lottie animation.
 */

const LOTTIE_PATH = '/assets/graduation-hat.json';
let cachedData = null;

async function getAnimationData() {
    if (!cachedData) {
        const res = await fetch(LOTTIE_PATH);
        cachedData = await res.json();
    }
    return JSON.parse(JSON.stringify(cachedData));
}

export function loadGraduationHat(container) {
    if (!window.lottie) return;
    getAnimationData().then(data => {
        window.lottie.loadAnimation({
            container,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            animationData: data,
        });
    });
}

export function initStaticLotties() {
    document.querySelectorAll('.lottie-graduation-hat').forEach(el => {
        if (!el.dataset.lottieInit) {
            el.dataset.lottieInit = 'true';
            loadGraduationHat(el);
        }
    });
}
