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
        this.focusCb = () => {};
    }

    onFocus(cb) { this.focusCb = cb || (() => {}); }

    loadVideo(file, onLoaded) {
        if (!this.view) this.createView();
        const url = URL.createObjectURL(file);
        this.video.src = url;
        this.video.onloadeddata = () => {
            this.fitVideoToFrame(); // Adjust video scaling and position on load
            this.video.play().catch(() => {});
            if (onLoaded) onLoaded();
            this.focusCb();
        };
    }

    createView() {
        this.view = document.createElement('div');
        this.view.id = 'videoView';
        this.view.style.position = 'relative';

        this.video = document.createElement('video');
        this.video.controls = true;
        this.video.style.transformOrigin = 'center center';
        this.video.style.position = 'absolute'; // Ensure absolute positioning for better scaling and centering
        this.video.autoplay = false;
        this.view.appendChild(this.video);

        const handles = this.createResizeHandles();
        handles.forEach(handle => this.view.appendChild(handle));

        this.root.appendChild(this.view);
        this.attachEvents(handles);
    }

    createResizeHandles() {
        const directions = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
        return directions.map(dir => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${dir}`;
            return handle;
        });
    }

    attachEvents(handles) {
        this.view.addEventListener('click', (e) => { e.stopPropagation(); this.focusCb(); });
        this.view.addEventListener('contextmenu', e => e.preventDefault());

        this.view.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.1 : -0.1;
            this.scale = Math.min(5, Math.max(0.05, this.scale + delta));
            this.applyTransform();
            this.focusCb();
        }, { passive: false });

        this.view.addEventListener('mousedown', e => {
            this.focusCb();
            if (e.target.matches('.resize-handle')) {
                this.isResizing = true;
                this.startSize = { w: this.view.offsetWidth, h: this.view.offsetHeight, x: e.clientX, y: e.clientY };
                this.resizeDirection = Array.from(e.target.classList).find(c => c.includes('-')); // Determine direction
            } else if (e.button === 2) {
                this.isPanning = true;
                this.startPan = { x: e.clientX, y: e.clientY, ox: this.offset.x, oy: this.offset.y };
            }
        });

        window.addEventListener('mousemove', e => {
            if (this.isResizing) {
                this.resizeView(e);
            }
            if (this.isPanning) {
                const dx = e.clientX - this.startPan.x;
                const dy = e.clientY - this.startPan.y;
                this.offset.x = this.startPan.ox + dx;
                this.offset.y = this.startPan.oy + dy;
                this.applyTransform();
            }
        });

        window.addEventListener('mouseup', () => {
            this.isPanning = false;
            this.isResizing = false;
        });
    }

    resizeView(e) {
        const dx = e.clientX - this.startSize.x;
        const dy = e.clientY - this.startSize.y;
        let newWidth = this.startSize.w;
        let newHeight = this.startSize.h;

        if (this.resizeDirection.includes('right')) newWidth += dx;
        if (this.resizeDirection.includes('bottom')) newHeight += dy;
        if (this.resizeDirection.includes('left')) newWidth -= dx;
        if (this.resizeDirection.includes('top')) newHeight -= dy;

        this.view.style.width = Math.max(200, newWidth) + 'px';
        this.view.style.height = Math.max(150, newHeight) + 'px';
    }

    applyTransform() {
        if (!this.video) return;
        this.video.style.transform = `translate(${this.offset.x}px, ${this.offset.y}px) scale(${this.scale})`;
    }

    fitVideoToFrame() {
        if (!this.video || !this.view) return;
        const { clientWidth, clientHeight } = this.view;
        const videoAspect = this.video.videoWidth / this.video.videoHeight;
        const frameAspect = clientWidth / clientHeight;

        if (videoAspect > frameAspect) {
            this.scale = clientWidth / this.video.videoWidth;
            this.offset.y = (clientHeight - this.video.videoHeight * this.scale) / 2;
            this.offset.x = 0;
        } else {
            this.scale = clientHeight / this.video.videoHeight;
            this.offset.x = (clientWidth - this.video.videoWidth * this.scale) / 2;
            this.offset.y = 0;
        }

        this.applyTransform();
    }
}