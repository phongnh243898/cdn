export class VideoManager {
    constructor(root = document.body) {
        this.root = root;
        this.view = null;
        this.video = null;
        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        this.isPanning = false;
        this.isResizing = false;
        this.startPan = { x: 0, y: 0, ox: 0, oy: 0 };
        this.startSize = { w: 400, h: 300, x: 0, y: 0 };
        this.resizeDirection = '';
    }

    loadVideo(file) {
        if (!this.view) this.createView();
        this.video.src = URL.createObjectURL(file);
        this.video.onloadedmetadata = () => { this.fitVideoToFrame(); this.video.play().catch(()=>{}); };
    }

    createView() {
        this.view = document.createElement('div');
        this.view.id = 'videoView';
        this.video = document.createElement('video');
        this.video.controls = true;
        this.video.style.position = 'relative';
        this.view.appendChild(this.video);

        ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach(dir => {
            const h = document.createElement('div');
            h.className = `resize-handle ${dir}`;
            this.view.appendChild(h);
        });
        this.root.appendChild(this.view);
        this.attachEvents();
    }

    attachEvents() {
        this.view.addEventListener('mousedown', e => {
            if (e.target.classList.contains('resize-handle')) {
                this.isResizing = true;
                this.resizeDirection = e.target.classList[1];
                this.startSize = { w: this.view.offsetWidth, h: this.view.offsetHeight, x: e.clientX, y: e.clientY };
                e.preventDefault();
            } else if (e.button === 2) { 
                this.isPanning = true;
                this.startPan = { x: e.clientX, y: e.clientY, ox: this.offset.x, oy: this.offset.y };
                e.preventDefault();
            }
        });

        this.view.addEventListener('wheel', e => {
            e.preventDefault();
            this.scale *= (e.deltaY < 0 ? 1.1 : 0.9);
            this.applyTransform();
        }, { passive: false });

        window.addEventListener('mousemove', e => {
            if (this.isResizing) {
                const dx = e.clientX - this.startSize.x, dy = e.clientY - this.startSize.y;
                if (this.resizeDirection.includes('right')) this.view.style.width = Math.max(150, this.startSize.w + dx) + 'px';
                if (this.resizeDirection.includes('bottom')) this.view.style.height = Math.max(100, this.startSize.h + dy) + 'px';
            }
            if (this.isPanning) {
                this.offset.x = this.startPan.ox + (e.clientX - this.startPan.x);
                this.offset.y = this.startPan.oy + (e.clientY - this.startPan.y);
                this.applyTransform();
            }
        });
        window.addEventListener('mouseup', () => { this.isPanning = false; this.isResizing = false; });
        this.view.addEventListener('contextmenu', e => e.preventDefault());
    }

    applyTransform() {
        if (this.video) this.video.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
    }

    fitVideoToFrame() {
        if (!this.video || !this.view) return;
        const aspect = this.video.videoWidth / this.video.videoHeight;
        const frameAspect = this.view.clientWidth / this.view.clientHeight;
        this.scale = (aspect > frameAspect) ? (this.view.clientWidth / this.video.videoWidth) : (this.view.clientHeight / this.video.videoHeight);
        this.offset = { x: 0, y: 0 };
        this.applyTransform();
    }
}
