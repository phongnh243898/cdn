import * as THREE from 'three';

const DEFAULT_CATEGORY_LIST = [
    { id: 205340, name: 'undrivable', color: 0xff0000 },
    { id: 205341, name: 'things',      color: 0xffff00 },
    { id: 205342, name: 'construction',color: 0x800080 },
    { id: 205343, name: 'uneven',      color: 0xffffff }
];

export class PolygonManager {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.polygons = [];
        this.current = null;
        this.isDrawing = false;
        this.raycaster = new THREE.Raycaster();
        this.raycaster.params.Line = { threshold: 0.15 };
        this.selected = null;
        this.categoryList = [...DEFAULT_CATEGORY_LIST];
        this.flatten = false; 
    }

    setFlatten(flag) {
        this.flatten = !!flag;
        this.polygons.forEach(p => {
            this.updateHandleStyles(p);
            this.redraw(p, p.closed);
        });
    }

    get defaultCategoryId() { return this.categoryList[0]?.id; }

    start() {
        this.isDrawing = true;
        const poly = { points: [], handles: [], line: null, closed: false, categoryId: this.defaultCategoryId };
        this.polygons.push(poly);
        this.current = poly;
        this.select(poly);
    }

    addPoint(event, camera) {
        if (!this.isDrawing || event.button !== 0 || !this.current) return;
        const pos = this.getMousePos(event, camera);
        if (pos) {
            const p = pos.clone();
            this.current.points.push(p);
            this.createHandle(this.current, p);
            this.redraw(this.current, false);
        }
    }

    createHandle(poly, pos) {
        const geo = new THREE.SphereGeometry(0.2, 16, 12);
        const mat = new THREE.MeshBasicMaterial({ color: this.getCategoryColor(poly.categoryId), depthTest: false, transparent: true, opacity: 0.8 });
        const handle = new THREE.Mesh(geo, mat);
        handle.position.set(pos.x, pos.y, this.flatten ? 0.1 : (pos.z || 0.1));
        handle.renderOrder = 3000;
        this.scene.add(handle);
        poly.handles.push(handle);
        this.updateHandleVisibility();
    }

    updateHandleStyles(poly) {
        const color = this.getCategoryColor(poly.categoryId);
        poly.handles.forEach((h, idx) => {
            if (h.material) h.material.color.set(color);
            const p = poly.points[idx];
            h.position.set(p.x, p.y, this.flatten ? 0.1 : (p.z || 0.1));
        });
    }

    updateHandleVisibility() {
        this.polygons.forEach(p => {
            const visible = (this.isDrawing && p === this.current) || p === this.selected;
            p.handles.forEach(h => h.visible = visible);
        });
    }

    getMousePos(event, camera) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        this.raycaster.setFromCamera(mouse, camera);
        const target = new THREE.Vector3();
        // Giao với mặt phẳng Z=0
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        return this.raycaster.ray.intersectPlane(plane, target) ? target : null;
    }

    handlePointerDown(event, camera) {
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        this.raycaster.setFromCamera(mouse, camera);

        const allHandles = this.polygons.flatMap(p => p.handles);
        const hits = this.raycaster.intersectObjects(allHandles);
        if (hits.length > 0) {
            const handle = hits[0].object;
            const poly = this.polygons.find(p => p.handles.includes(handle));
            this.select(poly);
            this.draggedHandle = handle;
            this.draggedPoly = poly;
            return { action: 'drag' };
        }
        return null;
    }

    onDrag(event, camera) {
        if (!this.draggedHandle) return;
        const pos = this.getMousePos(event, camera);
        if (pos) {
            const idx = this.draggedPoly.handles.indexOf(this.draggedHandle);
            this.draggedPoly.points[idx].copy(pos);
            this.draggedHandle.position.set(pos.x, pos.y, this.flatten ? 0.1 : (pos.z || 0.1));
            this.redraw(this.draggedPoly, this.draggedPoly.closed);
        }
    }

    onDragEnd() { this.draggedHandle = null; this.draggedPoly = null; }

    redraw(poly, closed = false) {
        if (poly.line) this.scene.remove(poly.line);
        if (poly.points.length < 2) return;

        const pts = this.flatten ? poly.points.map(p => new THREE.Vector3(p.x, p.y, 0)) : poly.points;
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const mat = new THREE.LineBasicMaterial({
            color: this.getCategoryColor(poly.categoryId),
            linewidth: (this.selected === poly) ? 3 : 1,
            depthTest: false,
            transparent: true
        });
        poly.line = closed ? new THREE.LineLoop(geo, mat) : new THREE.Line(geo, mat);
        poly.line.renderOrder = 2900;
        this.scene.add(poly.line);
    }

    finish() {
        if (this.current) {
            if (this.current.points.length < 3) {
                this.deleteSelected();
            } else {
                this.current.closed = true;
                this.redraw(this.current, true);
            }
        }
        this.isDrawing = false;
        this.current = null;
        this.updateHandleVisibility();
    }

    select(poly) {
        this.selected = poly;
        this.polygons.forEach(p => this.redraw(p, p.closed));
        this.updateHandleVisibility();
    }

    deleteSelected() {
        if (!this.selected) return;
        this.selected.handles.forEach(h => this.scene.remove(h));
        if (this.selected.line) this.scene.remove(this.selected.line);
        this.polygons = this.polygons.filter(p => p !== this.selected);
        this.selected = null;
        this.isDrawing = false;
    }

    getCategoryColor(id) {
        return this.categoryList.find(c => c.id === id)?.color || 0xff0000;
    }

    cycleCategory(dir = 1) {
        if (!this.selected) return;
        const idx = this.categoryList.findIndex(c => c.id === this.selected.categoryId);
        const next = (idx + dir + this.categoryList.length) % this.categoryList.length;
        this.selected.categoryId = this.categoryList[next].id;
        this.updateHandleStyles(this.selected);
        this.redraw(this.selected, this.selected.closed);
    }

    loadFromAnnotations(annotations = []) {
        this.polygons.forEach(p => {
            p.handles.forEach(h => this.scene.remove(h));
            if (p.line) this.scene.remove(p.line);
        });
        this.polygons = [];
        annotations.forEach(a => {
            if (a.shape !== 'polygon') return;
            const poly = {
                points: a.location.map(l => new THREE.Vector3(l.x, l.y, l.z || 0)),
                handles: [],
                line: null,
                closed: true,
                categoryId: a.category_id
            };
            this.polygons.push(poly);
            poly.points.forEach(p => this.createHandle(poly, p));
            this.redraw(poly, true);
        });
    }

    getAnnotations() {
        return {
            annotations: this.polygons.filter(p => p.closed).map((p, i) => ({
                id: i + 1,
                shape: 'polygon',
                category_id: p.categoryId,
                location: p.points.map(pt => ({ x: pt.x, y: pt.y, z: pt.z }))
            }))
        };
    }
}
