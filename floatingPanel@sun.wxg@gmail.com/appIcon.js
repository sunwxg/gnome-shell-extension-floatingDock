const { Clutter, Gio, GLib, GObject, Meta, Shell, St } = imports.gi;
const Params = imports.misc.params;
const IconGrid = imports.ui.iconGrid;
const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;
const DND = imports.ui.dnd;
const AppDisplay = imports.ui.appDisplay;

var MENU_POPUP_TIMEOUT = 600;

var MyAppIcon = GObject.registerClass({
    Signals: {
        'menu-state-changed': { param_types: [GObject.TYPE_BOOLEAN] },
        'sync-tooltip': {},
    },
}, class MyAppIcon extends St.Button {
    _init(app, iconParams = {}) {
        super._init({
            style_class: 'app-well-app',
            //pivot_point: new Graphene.Point({ x: 0.5, y: 0.5 }),
            reactive: true,
            button_mask: St.ButtonMask.ONE | St.ButtonMask.TWO,
            can_focus: true,
        });

        this.app = app;
        this.id = app.get_id();
        this.name = app.get_name();

        this._iconContainer = new St.Widget({ layout_manager: new Clutter.BinLayout(),
                                              x_expand: true, y_expand: true });

        this.set_child(this._iconContainer);

        this._delegate = this;

        this._hasDndHover = false;
        this._folderPreviewId = 0;

        // Get the isDraggable property without passing it on to the BaseIcon:
        let appIconParams = Params.parse(iconParams, { isDraggable: true }, true);
        let isDraggable = appIconParams['isDraggable'];
        delete iconParams['isDraggable'];

        iconParams['createIcon'] = this._createIcon.bind(this);
        iconParams['setSizeManually'] = true;
        this.icon = new IconGrid.BaseIcon(app.get_name(), iconParams);
        this._iconContainer.add_child(this.icon);

        this._dot = new St.Widget({
            style_class: 'app-well-app-running-dot',
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
        });
        this._iconContainer.add_child(this._dot);

        this.label_actor = this.icon.label;

        this.connect('popup-menu', this._onKeyboardPopupMenu.bind(this));

        this._menu = null;
        this._menuManager = new PopupMenu.PopupMenuManager(this);

        if (isDraggable) {
            this._draggable = DND.makeDraggable(this);
            this._draggable.connect('drag-begin', () => {
                this._dragging = true;
                this.scaleAndFade();
                this._removeMenuTimeout();
                Main.overview.beginItemDrag(this);
            });
            this._draggable.connect('drag-cancelled', () => {
                this._dragging = false;
                Main.overview.cancelledItemDrag(this);
            });
            this._draggable.connect('drag-end', () => {
                this._dragging = false;
                this.undoScaleAndFade();
                Main.overview.endItemDrag(this);
            });
        }

        this._dragMonitor = null;
        this._itemDragBeginId = Main.overview.connect(
            'item-drag-begin', this._onDragBegin.bind(this));
        this._itemDragEndId = Main.overview.connect(
            'item-drag-end', this._onDragEnd.bind(this));

        this._menuTimeoutId = 0;
        this._stateChangedId = this.app.connect('notify::state', () => {
            this._updateRunningStyle();
        });
        this._updateRunningStyle();

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _onDestroy() {
        Main.overview.disconnect(this._itemDragBeginId);
        Main.overview.disconnect(this._itemDragEndId);

        if (this._folderPreviewId > 0) {
            GLib.source_remove(this._folderPreviewId);
            this._folderPreviewId = 0;
        }
        if (this._stateChangedId > 0)
            this.app.disconnect(this._stateChangedId);

        if (this._dragMonitor) {
            DND.removeDragMonitor(this._dragMonitor);
            this._dragMonitor = null;
        }

        if (this._draggable) {
            if (this._dragging)
                Main.overview.endItemDrag(this);
            this._draggable = null;
        }
        this._stateChangedId = 0;
        this._removeMenuTimeout();
    }

    _createIcon(iconSize) {
        return this.app.create_icon_texture(iconSize);
    }

    _removeMenuTimeout() {
        if (this._menuTimeoutId > 0) {
            GLib.source_remove(this._menuTimeoutId);
            this._menuTimeoutId = 0;
        }
    }

    _updateRunningStyle() {
        if (this.app.state != Shell.AppState.STOPPED)
            this._dot.show();
        else
            this._dot.hide();
    }

    _setPopupTimeout() {
        this._removeMenuTimeout();
        this._menuTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, MENU_POPUP_TIMEOUT, () => {
            this._menuTimeoutId = 0;
            this.popupMenu();
            return GLib.SOURCE_REMOVE;
        });
        GLib.Source.set_name_by_id(this._menuTimeoutId, '[gnome-shell] this.popupMenu');
    }

    vfunc_leave_event(crossingEvent) {
        let ret = super.vfunc_leave_event(crossingEvent);

        this.fake_release();
        this._removeMenuTimeout();
        return ret;
    }

    vfunc_button_press_event(buttonEvent) {
        super.vfunc_button_press_event(buttonEvent);
        if (buttonEvent.button == 1) {
            this._setPopupTimeout();
        } else if (buttonEvent.button == 3) {
            this.popupMenu();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_touch_event(touchEvent) {
        super.vfunc_touch_event(touchEvent);
        if (touchEvent.type == Clutter.EventType.TOUCH_BEGIN)
            this._setPopupTimeout();

        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_clicked(button) {
        this._removeMenuTimeout();
        this.activate(button);
    }

    _onKeyboardPopupMenu() {
        this.popupMenu();
        this._menu.actor.navigate_focus(null, St.DirectionType.TAB_FORWARD, false);
    }

    getId() {
        return this.app.get_id();
    }

    popupMenu() {
        this._removeMenuTimeout();
        this.fake_release();

        if (this._draggable)
            this._draggable.fakeRelease();

        if (!this._menu) {
            this._menu = new AppDisplay.AppIconMenu(this);
            this._menu.connect('activate-window', (menu, window) => {
                this.activateWindow(window);
            });
            this._menu.connect('open-state-changed', (menu, isPoppedUp) => {
                if (!isPoppedUp)
                    this._onMenuPoppedDown();
            });
            let id = Main.overview.connect('hiding', () => {
                this._menu.close();
            });
            this.connect('destroy', () => {
                Main.overview.disconnect(id);
            });

            this._menuManager.addMenu(this._menu);
        }

        this.emit('menu-state-changed', true);

        this.set_hover(true);
        this._menu.popup();
        this._menuManager.ignoreRelease();
        this.emit('sync-tooltip');

        return false;
    }

    activateWindow(metaWindow) {
        if (metaWindow)
            Main.activateWindow(metaWindow);
        else
            Main.overview.hide();
    }

    _onMenuPoppedDown() {
        this.sync_hover();
        this.emit('menu-state-changed', false);
    }

    activate(button) {
        let event = Clutter.get_current_event();
        let modifiers = event ? event.get_state() : 0;
        let isMiddleButton = button && button == Clutter.BUTTON_MIDDLE;
        let isCtrlPressed = (modifiers & Clutter.ModifierType.CONTROL_MASK) != 0;
        let openNewWindow = this.app.can_open_new_window() &&
                            this.app.state == Shell.AppState.RUNNING &&
                            (isCtrlPressed || isMiddleButton);

        if (this.app.state == Shell.AppState.STOPPED || openNewWindow)
            this.animateLaunch();

        if (openNewWindow)
            this.app.open_new_window(-1);
        else
            this.app.activate();

        Main.overview.hide();
    }

    animateLaunch() {
        this.icon.animateZoomOut();
    }

    animateLaunchAtPos(x, y) {
        this.icon.animateZoomOutAtPos(x, y);
    }

    scaleIn() {
        this.scale_x = 0;
        this.scale_y = 0;

        this.ease({
            scale_x: 1,
            scale_y: 1,
            duration: APP_ICON_SCALE_IN_TIME,
            delay: APP_ICON_SCALE_IN_DELAY,
            mode: Clutter.AnimationMode.EASE_OUT_QUINT,
        });
    }

    shellWorkspaceLaunch(params) {
        let { stack } = new Error();
        log(`shellWorkspaceLaunch is deprecated, use app.open_new_window() instead\n${stack}`);

        params = Params.parse(params, { workspace: -1,
                                        timestamp: 0 });

        this.app.open_new_window(params.workspace);
    }

    getDragActor() {
        return this.app.create_icon_texture(Main.overview.dash.iconSize);
    }

    // Returns the original actor that should align with the actor
    // we show as the item is being dragged.
    getDragActorSource() {
        return this.icon.icon;
    }

    shouldShowTooltip() {
        return this.hover && (!this._menu || !this._menu.isOpen);
    }

    scaleAndFade() {
        this.reactive = false;
        this.ease({
            scale_x: 0.75,
            scale_y: 0.75,
            opacity: 128,
        });
    }

    undoScaleAndFade() {
        this.reactive = true;
        this.ease({
            scale_x: 1.0,
            scale_y: 1.0,
            opacity: 255,
        });
    }

    _showFolderPreview() {
        this.icon.label.opacity = 0;
        this.icon.icon.ease({
            scale_x: FOLDER_SUBICON_FRACTION,
            scale_y: FOLDER_SUBICON_FRACTION,
        });
    }

    _hideFolderPreview() {
        this.icon.label.opacity = 255;
        this.icon.icon.ease({
            scale_x: 1.0,
            scale_y: 1.0,
        });
    }

    _canAccept(source) {
        let view = _getViewFromIcon(source);

        return source != this &&
               (source instanceof this.constructor) &&
               (view instanceof AllView);
    }

    _setHoveringByDnd(hovering) {
        if (hovering) {
            if (this._folderPreviewId > 0)
                return;

            this._folderPreviewId =
                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                    this.add_style_pseudo_class('drop');
                    this._showFolderPreview();
                    this._folderPreviewId = 0;
                    return GLib.SOURCE_REMOVE;
                });
        } else {
            if (this._folderPreviewId > 0) {
                GLib.source_remove(this._folderPreviewId);
                this._folderPreviewId = 0;
            }
            this._hideFolderPreview();
            this.remove_style_pseudo_class('drop');
        }
    }

    _onDragBegin() {
        this._dragMonitor = {
            dragMotion: this._onDragMotion.bind(this),
        };
        DND.addDragMonitor(this._dragMonitor);
    }

    _onDragMotion(dragEvent) {
        let target = dragEvent.targetActor;
        let isHovering = target == this || this.contains(target);
        let canDrop = this._canAccept(dragEvent.source);
        let hasDndHover = isHovering && canDrop;

        if (this._hasDndHover != hasDndHover) {
            this._setHoveringByDnd(hasDndHover);
            this._hasDndHover = hasDndHover;
        }

        return DND.DragMotionResult.CONTINUE;
    }

    _onDragEnd() {
        this.remove_style_pseudo_class('drop');
        DND.removeDragMonitor(this._dragMonitor);
    }

    handleDragOver(source) {
        if (source == this)
            return DND.DragMotionResult.NO_DROP;

        if (!this._canAccept(source))
            return DND.DragMotionResult.CONTINUE;

        return DND.DragMotionResult.MOVE_DROP;
    }

    acceptDrop(source) {
        this._setHoveringByDnd(false);

        if (!this._canAccept(source))
            return false;

        let view = _getViewFromIcon(this);
        let apps = [this.id, source.id];

        return view.createFolder(apps);
    }
});

