// ============================================
// Header height → CSS variable --header-h (used to place things below the sticky header)
// ============================================
const siteHeader = document.querySelector('.site-header');
const setHeaderHeight = () =>
    document.documentElement.style.setProperty('--header-h', `${siteHeader.offsetHeight}px`);
setHeaderHeight();
new ResizeObserver(setHeaderHeight).observe(siteHeader);

// ============================================
// 0. HERO SCROLL ANIMATION — Header 1 → Header 12
//    The further you scroll through the hero, the later the frame.
// ============================================
const hero = document.getElementById('hero');
const frames = [...hero.querySelectorAll('.hero-frames img')];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let currentFrame = 0;
let ticking = false;

function updateHero() {
    ticking = false;
    const sticky = hero.querySelector('.hero-sticky');
    const pinTop = parseFloat(getComputedStyle(sticky).top);           // where the frames get pinned
    const heroTop = hero.getBoundingClientRect().top + window.scrollY;
    const start = Math.max(0, heroTop - pinTop);                       // scroll position where frames get pinned
    const end = heroTop - pinTop + hero.offsetHeight - sticky.offsetHeight;   // …and where they let go
    const progress = Math.min(Math.max((window.scrollY - start) / (end - start), 0), 1);
    const index = Math.min(frames.length - 1, Math.floor(progress * frames.length));

    if (index !== currentFrame) {
        frames[currentFrame].classList.remove('is-active');
        frames[index].classList.add('is-active');
        currentFrame = index;
    }
}

if (!reduceMotion && frames.length > 1) {
    window.addEventListener('scroll', () => {
        if (!ticking) { ticking = true; requestAnimationFrame(updateHero); }
    }, { passive: true });
    window.addEventListener('resize', updateHero);
    updateHero();
}

// ============================================
// 1. TABS — Personal projects / Client work
// ============================================
document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((t) => {
            t.classList.toggle('is-active', t === tab);
            t.setAttribute('aria-selected', t === tab);
        });
        document.querySelectorAll('.gallery').forEach((panel) => {
            panel.hidden = panel.dataset.panel !== tab.dataset.tab;
        });
    });
});

// ============================================
// 2. IMAGE SLIDERS inside each card
//    Arrows + dots are added automatically when a card has 2+ images.
// ============================================
const arrow = (dir) => `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path d="${dir === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

document.querySelectorAll('.card').forEach((card) => {
    const media = card.querySelector('.card-media');
    const images = [...card.querySelectorAll('.slides img')];
    let current = 0;
    images[0]?.classList.add('is-active');

    if (images.length < 2) return;

    media.insertAdjacentHTML('beforeend', `
        <button class="round-btn slide-btn prev" aria-label="Previous image">${arrow('prev')}</button>
        <button class="round-btn slide-btn next" aria-label="Next image">${arrow('next')}</button>
        <div class="dots">${images.map(() => '<span></span>').join('')}</div>`);

    const dots = [...media.querySelectorAll('.dots span')];

    const show = (i) => {
        current = (i + images.length) % images.length;
        images.forEach((img, n) => img.classList.toggle('is-active', n === current));
        dots.forEach((d, n) => d.classList.toggle('is-active', n === current));
    };
    show(0);

    media.querySelector('.prev').addEventListener('click', (e) => { e.stopPropagation(); show(current - 1); });
    media.querySelector('.next').addEventListener('click', (e) => { e.stopPropagation(); show(current + 1); });

    // Swipe on phones / tablets
    let startX = null;
    media.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    media.addEventListener('touchend', (e) => {
        if (startX === null) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) { card.dataset.swiped = '1'; show(current + (dx < 0 ? 1 : -1)); }
        startX = null;
    });
});

// ============================================
// 3. PROJECT POP-UP — opens when a card is clicked
//    If the card has data-model="models/xxx.glb", the pop-up shows the 3D viewer.
// ============================================
// 3D model lighting. Tweak these numbers to taste:
//   environment-image: 'legacy' = light from the front, more shading; 'neutral' = even, flatter light
//   exposure:          brightness (1 = normal, lower = darker, more contrast on white objects)
//   tone-mapping:      'agx' = more filmic contrast; 'neutral' = true-to-color but flatter
//   shadow-intensity:  0 = no shadow under the model, up to 2 = strong
//   shadow-softness:   0 = sharp shadow, 1 = very soft
const VIEWER_LOOK = {
    'environment-image': 'legacy',
    'exposure': '0.85',
    'tone-mapping': 'agx',
    'shadow-intensity': '1.5',
    'shadow-softness': '0.5',
    // camera-orbit: 'horizontal angle, vertical angle, distance'.
    // Distance 100% fits the model exactly; bigger = smaller model with more space around it.
    'camera-orbit': '0deg 75deg 150%',
    'camera-target': 'auto auto auto',   // aim at the center of the model
};

const modal = document.getElementById('project-modal');
const modalTitle = modal.querySelector('.modal-title');
const modalMedia = modal.querySelector('.modal-media');
const modalText = modal.querySelector('.modal-description');

document.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('click', () => {
        if (card.dataset.swiped) { delete card.dataset.swiped; return; }  // a swipe isn't a click

        const { title, year, model, description } = card.dataset;
        let pendingViewer = null;
        const activeImg = card.querySelector('.slides img.is-active') || card.querySelector('.slides img');

        modal.classList.toggle('modal--dark', card.dataset.theme === 'dark');
        modalTitle.textContent = year ? `${title} (${year})` : title;
        modalText.textContent = description || '';
        modalMedia.innerHTML = '';
        modalMedia.style.backgroundImage = '';

        if (model) {
            // Show the card image until the 3D model has loaded
            if (activeImg) modalMedia.style.backgroundImage = `url("${activeImg.getAttribute('src')}")`;
            const viewer = document.createElement('model-viewer');
            viewer.setAttribute('src', model);
            viewer.setAttribute('alt', `3D model: ${title}`);
            viewer.setAttribute('camera-controls', '');
            viewer.setAttribute('touch-action', 'pan-y');
            viewer.setAttribute('auto-rotate', '');
            // Look of the 3D model — adjust in VIEWER_LOOK above
            Object.entries(VIEWER_LOOK).forEach(([k, v]) => viewer.setAttribute(k, v));
            viewer.addEventListener('load', () => {
                modalMedia.style.backgroundImage = 'none';
                viewer.updateFraming?.();   // re-center now that the model and pop-up size are known
            });
            pendingViewer = viewer;
        } else if (activeImg) {
            modalMedia.appendChild(activeImg.cloneNode());
            modalMedia.firstChild.classList.remove('is-active');
        }

        modal.showModal();

        // Add the 3D viewer only after the pop-up is open, so it knows its real size
        if (pendingViewer) {
            modalMedia.appendChild(pendingViewer);
            pendingViewer = null;
        }
    });
});

modal.querySelector('.modal-close').addEventListener('click', () => modal.close());
modal.addEventListener('close', () => { modalMedia.innerHTML = ''; });   // stops the 3D viewer

// ============================================
// 4. "BLACK" MODE TOGGLE in the footer (remembered between visits)
// ============================================
const themeSwitch = document.getElementById('theme-switch');

try {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark');
        themeSwitch.checked = true;
    }
} catch (e) { /* storage not available — ignore */ }

themeSwitch.addEventListener('change', () => {
    document.body.classList.toggle('dark', themeSwitch.checked);
    try { localStorage.setItem('theme', themeSwitch.checked ? 'dark' : 'light'); } catch (e) {}
});
