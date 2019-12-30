const { Clutter, Gio, GObject, Shell, St } = imports.gi;

const Main = imports.ui.main;
const DND = imports.ui.dnd;
const AppFavorites = imports.ui.appFavorites;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const ItemContainer = Me.imports.itemContainer.ItemContainer;
const NUMBER_TO_CHAR_UPPERCASE = Me.imports.util.NUMBER_TO_CHAR_UPPERCASE;
const NUMBER_TO_CHAR = Me.imports.util.NUMBER_TO_CHAR;

var ICON_SIZE = 48;
var ITEM_ANIMATION_TIME = 1000;

var WINDOW_DND_SIZE = 256;
var DRAGGING_WINDOW_OPACITY = 0;

var DragDropResult = {
    FAILURE:  0,
    SUCCESS:  1,
    CONTINUE: 2,
};

var PanelBox = GObject.registerClass({
    Signals: {
        'size-changed': {},
    },
}, class PanelBox extends St.BoxLayout {
    _init(direction) {
        super._init({ name: 'floating-panel',
                      can_focus: true,
                      reactive: true,
                      x_align: Clutter.ActorAlign.CENTER });

        this.direction = direction;
        switch (direction) {
        case 'up':
        case 'down':
            this.set_vertical(true);
            break;
        case 'left':
        case 'right':
            this.set_vertical(false);
            break;
        default:
            break;
        }

        this._mainButton = this._createMainButton();
        this._mainButton._delegate = this;
        this._draggable = DND.makeDraggable(this._mainButton,
                                            { restoreOnSuccess: false,
                                              manualMode: false,
                                              dragActorMaxSize: WINDOW_DND_SIZE,
                                              dragActorOpacity: DRAGGING_WINDOW_OPACITY });
        this._draggable.connect('drag-begin', this._onDragBegin.bind(this));
        this._draggable.connect('drag-cancelled', this._onDragCancelled.bind(this));
        this._draggable.connect('drag-end', this._onDragEnd.bind(this));

        this._mainButton.connect('clicked', this._mainButtonClicked.bind(this));
        this.add_child(this._mainButton)

        let [x, y] =global.get_pointer();
        this._x = x;
        this._y = y;
        this._showApp = false;

        this._vimMode = false;

        //this._box = new St.BoxLayout ({ style_class: 'item-box',
                                        //vertical: true });
        this._box = new ItemBox(this.direction);
        switch (direction) {
        case 'up':
        case 'left':
            this.insert_child_below(this._box, null);
            break;
        case 'down':
        case 'right':
            this.insert_child_above(this._box, null);
            break;
        default:
            break;
        }

        this.add_child(this._box);

        this._workId = Main.initializeDeferredWork(this, this._redisplay.bind(this));

        this._appSystem = Shell.AppSystem.get_default();

        this._appSystem.connect('installed-changed', () => {
            AppFavorites.getAppFavorites().reload();
            this.queueRedisplay();
        });

        AppFavorites.getAppFavorites().connect('changed', this.queueRedisplay.bind(this));
        this._appSystem.connect('app-state-changed', this.queueRedisplay.bind(this));

        this._overViewShownID = Main.overview.connect('showing', () => { this.hide() });
        this._overViewHiddenID = Main.overview.connect('hiding', () => { this.show() });
        //Main.uiGroup.add_child(this);
        Main.layoutManager.addChrome(this, { affectsInputRegion: true });
    }

    _createMainButton() {
        let gicon = new Gio.FileIcon({
                    file: Gio.File.new_for_path(Me.path + '/icons/flag.png') });
        let icon = new St.Icon({ gicon: gicon,
                                 icon_size: ICON_SIZE });

        let button= new St.Button({ style_class: 'main-button',
                                    child: icon });

        return button;
    }

    _getDragButton() {
        let gicon = new Gio.FileIcon({
                    file: Gio.File.new_for_path(Me.path + '/icons/flag.png') });
        let icon = new St.Icon({ gicon: gicon,
                                 icon_size: ICON_SIZE });

        let button= new St.Button({ style_class: 'item-container',
                                    child: icon });

        return button;
    }

    _updatePositionRedisplay(oldLength, oldWidth, oldHeight){
        let [x, y] = this.get_position();
        let children = this._box.get_children();
        let newWidth = (oldWidth / oldLength) * children.length;
        let newHeight = (oldHeight / oldLength) * children.length;

        switch (this.direction) {
        case 'up':
            this._y = y - (newHeight - oldHeight);
            break;
        case 'left':
            this._x = x - (newWidth - oldWidth);
            break;
        case 'down':
        case 'right':
        default:
            break;
        }
    }

    _redisplay() {
        let oldLength = this._box.get_children().length;
        let box = this._box.get_allocation_box();
        let oldWidth = box.x2 - box.x1;
        let oldHeight = box.y2 - box.y1;

        let children = this._box.get_children();
        children.map(actor => { actor.destroy(); });

        this._itemNumber = 0;
        this._getFavorites();
        this._addApps();

        if (this._showApp)
            this._updatePositionRedisplay(oldLength, oldWidth, oldHeight);

        this._showPanel(this._x, this._y);
    }

    _findInBox(app) {
        let children = this._box.get_children();
        let result = false;
        for (let i = 0; i < children.length; i++) {
            if (children[i].app.id == app.id) {
                result = true;
                break;
            }
        }
        return result;
    }

    _addApps() {
        this._appSystem = Shell.AppSystem.get_default();
        let running = this._appSystem.get_running();

        for (let i = 0; i < running.length; i++) {
            if (this._findInBox(running[i]))
                continue;

            let item = new ItemContainer(running[i], this._vimMode, this._itemNumber++);
            item.child.connect('clicked', this._appButtonClicked.bind(this));
            item.child.connect('activate-window', this._appButtonClicked.bind(this));

            this._box.add_child(item);
        }
    }

    _getFavorites() {
        let favorites = AppFavorites.getAppFavorites().getFavoriteMap();

        for (let i in favorites) {
            let item = new ItemContainer(favorites[i], this._vimMode, this._itemNumber++);
            item.child.connect('clicked', this._appButtonClicked.bind(this));
            item.child.connect('activate-window', this._appButtonClicked.bind(this));
            this._box.add_child(item);
        }
    }

    _appButtonClicked(button) {
        //this._showApp = false;
        if (this._vimMode) {
            this._vimMode = false;
            Main.popModal(this);
            this._redisplay();
        }

        //this._box.hide();
        //this._updatePosition('hide');
        //this.set_position(this._x, this._y);
    }

    _appItemSelected(number, newWindow) {
        let children = this._box.get_children();
        let item = children.find( (element) => {
            return element.number == number;
        });
        if (item) {
            item.child.newWindow = newWindow;
            item.child.emit('clicked', item.child);
        }
    }

    _updatePosition(action) {
        let box = this._box.get_allocation_box();
        let boxWidth = box.x2 - box.x1;
        let boxHeight = box.y2 - box.y1;
        let [x, y] = this.get_position();
        switch (this.direction) {
        case 'up':
            this._y = y - boxHeight;
            if (action == 'show')
                this._y = y - boxHeight;
            else
                this._y = y + boxHeight;
            break;
        case 'left':
            if (action == 'show')
                this._x = x - boxWidth;
            else
                this._x = x + boxWidth;
            break;
        case 'down':
        case 'right':
        default:
            break;
        }
    }

    _mainButtonClicked() {
        this._showApp = !this._showApp;
        if (this._showApp) {
            this._box.show();
            this._updatePosition('show');
            //this._boxAnimation();
        } else {
            this._box.hide();
            this._updatePosition('hide');
        //this.set_position(this._x, this._y);
        }
        this.set_position(this._x, this._y);
    }

    _showPanel(x, y) {
        this._x = x;
        this._y = y;

        this.set_position(this._x, this._y);

        if (this._showApp) {
            this._box.show();
            //this._boxAnimation(this._box.show);
        } else {
            //this._boxAnimation();
            this._box.hide();
        }
    }

    showItem() {
        this._vimMode = true;
        if (this._showApp) {
            this._showApp = true;
        } else {
            this._showApp = true;
            this._box.show();
            this._updatePosition('show');
            this.set_position(this._x, this._y);
        }
        Main.queueDeferredWork(this._workId);

        Main.pushModal(this);
    }

    vfunc_key_press_event(keyEvent) {
        let symbol = keyEvent.keyval;
        if (symbol == Clutter.KEY_Escape) {
            Main.popModal(this);
            this._showApp = false;
            this._vimMode = false;
            this._redisplay();
            this._box.hide();
            this._updatePosition('hide');
            this.set_position(this._x, this._y);
            return Clutter.EVENT_STOP;
        }

        let number = NUMBER_TO_CHAR.findIndex( (element) => {
                                                return element == symbol; });
        if (number >= 0) {
            this._appItemSelected(number, false);
            return Clutter.EVENT_STOP;
        }

        number = NUMBER_TO_CHAR_UPPERCASE.findIndex( (element) => {
                                                return element == symbol; });
        if (number >= 0)
            this._appItemSelected(number, true);

        return Clutter.EVENT_STOP;
    }

    _boxAnimation() {
        let fullWidth = this.get_width();
        let fullHeight = this.get_height();

        this._box.ease({
            //opacity: 255,
            //width: fullWidth,
            height: fullHeight,
            duration: ITEM_ANIMATION_TIME,
            delay: ITEM_ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this._showPanel(this._x, this._y),
        });

        //let factor = 1.0;
        //this.ease_property('@effects.desaturate.factor', factor, {
            //duration: 500, // ms
            //mode: Clutter.AnimationMode.EASE_OUT_QUAD
        //});
    }

    queueRedisplay() {
        this._vimMode = false;
        Main.queueDeferredWork(this._workId);
    }

    _onDragMotion(dropEvent) {
        let lastX, lastY;
        switch (this.direction) {
        case 'up':
            [lastX, lastY] = this._mainButton.get_position();
            this._x = dropEvent.dragActor.x;
            this._y = dropEvent.dragActor.y - lastY;
            break;
        case 'left':
            [lastX, lastY] = this._mainButton.get_position();
            this._x = dropEvent.dragActor.x - lastX;
            this._y = dropEvent.dragActor.y;
            break;
        case 'down':
        case 'right':
            this._x = dropEvent.dragActor.x;
            this._y = dropEvent.dragActor.y;
        default:
            break;
        }

        //this._showPanel(dropEvent.dragActor.x, dropEvent.dragActor.y);
        this._showPanel(this._x, this._y);
        return DND.DragMotionResult.CONTINUE;
    }

    _onDragBegin(_draggable, _time) {
        this._dragMonitor = {
            dragMotion: this._onDragMotion.bind(this),
        };
        DND.addDragMonitor(this._dragMonitor);
    }

    _onDragCancelled(_draggable, _time) {
    }

    _onDragEnd(_draggable, _time, _snapback) {
        DND.removeDragMonitor(this._dragMonitor);
    }

    getDragActor() {
        return this._getDragButton();
    }

    getDragActorSource() {
        return this._mainButton;
    }

    acceptDrop() {
        return true;
    }

    destroy() {
        if (this._overViewShownID)
            Main.overview.disconnect(this._overViewShownID);
        if (this._overViewHiddenID)
            Main.overview.disconnect(this._overViewHiddenID);

        Main.layoutManager.removeChrome(this);
    }
});

var ItemBox = GObject.registerClass(
class ItemBox extends St.BoxLayout {
    _init(direction) {
        super._init({ style_class: 'item-box' });

        switch (direction) {
        case 'up':
        case 'down':
            this.set_vertical(true);
            break;
        case 'left':
        case 'right':
            this.set_vertical(false);
            break;
        default:
            break;
        }
    }
});
