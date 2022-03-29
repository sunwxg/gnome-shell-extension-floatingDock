const { Gtk, Clutter, GObject, Shell, St } = imports.gi;

const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Util = Me.imports.util;
const Extension = Me.imports.extension;
const CreateNumberIcon = Me.imports.numberIcon.createNumberIcon;
const NUMBER_TO_CHAR = Me.imports.util.NUMBER_TO_CHAR;


const DIRECTION = 'floating-dock-direction';

const PREVIEW_MAX_WIDTH = 250;
const PREVIEW_MAX_HEIGHT = 150;

var WindowPreviewMenu = class WindowPreviewMenu extends PopupMenu.PopupMenu {
    constructor(source, iconSize) {
        let direction, style;
        [direction, style] = getDirectionStyle(source);
        super(source, 0.5, direction);
        this.actor.set_style(style);

        this.iconSize = iconSize;
        this._source = source;

        this.actor.connectObject('captured-event',
            this._onCapturedEvent.bind(this), this);

        Main.uiGroup.add_actor(this.actor);
        this.actor.hide();
    }

    _onCapturedEvent(actor, event) {
        if (event.type() === Clutter.EventType.KEY_PRESS) {
            let symbol = event.get_key_symbol();
            let number = NUMBER_TO_CHAR.findIndex( (element) => {
                                                    return element == symbol; });
            if (number >= 0) {
                this._source.activateWindow(this._windows[number]);
                return Clutter.EVENT_STOP;
            }
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _redisplay() {
        this.removeAll();

        this._menuSection = new WindowPreviewMenuSection();
        this.addMenuItem(this._menuSection);

        let windows = this._source.app.get_windows();
        if (this._source.currentWorkspace) {
            windows = windows.filter( (window) => {
                return Util.windowInActiveWorkspace(window);
            });
        }

        this._windows = [];
        let k = 0;
        for (let i in windows) {
            this._windows.push(windows[i]);
            let menuItem = new WindowPreviewMenuItem(windows[i], this._source, k++, this.iconSize);
            this._menuSection.addMenuItem(menuItem);
        }
    }

    popup() {
        this._redisplay();
        this.open();
    }
};

var WindowPreviewMenuSection = class WindowPreviewMenuSection extends PopupMenu.PopupMenuSection {
    constructor() {
        super();
        let scroll = new St.ScrollView({ hscrollbar_policy: Gtk.PolicyType.NEVER,
                                         vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                                         enable_mouse_scrolling: true });
        this.actor = scroll;
        this.actor.add_actor(this.box);
        this.actor._delegate = this;
    }
};

var WindowPreviewMenuItem = GObject.registerClass(
class WindowPreviewMenuItem extends PopupMenu.PopupBaseMenuItem {
    _init(window, button, number, iconSize) {
        super._init({});

        this._window = window;
        this._button = button;
        this._number = number;
        this.iconSize = iconSize;

        if (button.vimMode) {
            this.setSensitive(false);
        }

        this._cloneBin = new St.Bin();
        this._cloneBin.set_size(PREVIEW_MAX_WIDTH, PREVIEW_MAX_HEIGHT);
        this.add_child(this._cloneBin);

        this._cloneWindow(window);

        this.connect('destroy', () => { this._onDestroy(); });
    }

    _cloneWindow(window) {
        let mutterWindow = window.get_compositor_private();

        let [width, height] = mutterWindow.get_size();
        let scale = Math.min(1.0, PREVIEW_MAX_WIDTH/width, PREVIEW_MAX_HEIGHT/height);
        let clone = new Clutter.Clone ({ source: mutterWindow,
                                         reactive: true,
                                         width: width * scale,
                                         height: height * scale });
        this._clone = clone;

        this._cloneBox = new St.Widget({ layout_manager: new Clutter.BinLayout() });
        this._cloneBox.destroy_all_children();
        this._cloneBox.add_child(this._clone);

        if (this._button.vimMode)
            this._cloneBox.add_child(CreateNumberIcon(this._number, this.iconSize));

        this._cloneBin.set_child(this._cloneBox);

        this._mutterWindow = mutterWindow;
        this._mutterWindowId = this._mutterWindow.connect('destroy', () => {
            this.destroy();
            this._mutterWindowId = 0;
        });
    }

    vfunc_button_release_event() {
        this._getTopMenu().close();
        this._button.activateWindow(this._window);
        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_touch_event(touchEvent) {
        if (touchEvent.type == Clutter.EventType.TOUCH_END) {
            this._getTopMenu().close();
            this._button.activateWindow(this._window);
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _onDestroy() {
        if (this._mutterWindowId) {
            this._mutterWindow.disconnect(this._mutterWindowId);
            this._mutterWindowId = 0;
        }
    }
});

function getDirectionStyle(source) {
    const sourceAllocation = source.get_transformed_extents();
    let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
    // -arrow-base + -arrow-border-radius*2 + -arrow-border-width*2
    let arrowHeight = (24 + 9 * 2 + 2);

    let style = '';
    let direction;
    switch (Util.getPosition(Extension.gsettings.get_string(DIRECTION))) {
    case St.Side.TOP:
    case St.Side.BOTTOM:
        if (sourceAllocation.x1 > (workArea.x + workArea.width / 2)) {
            direction = St.Side.RIGHT;
        } else {
            direction = St.Side.LEFT;
        }
        style = 'max-height: %spx;'.format(workArea.height - arrowHeight);
        break;
    case St.Side.LEFT:
    case St.Side.RIGHT:
        if (sourceAllocation.y1 > (workArea.y + workArea.height / 2)) {
            direction = St.Side.BOTTOM;
            style = 'max-height: %spx;'.format(sourceAllocation.y1 - workArea.y);
        } else {
            direction = St.Side.TOP;
            style = 'max-height: %spx;'.format(workArea.y + workArea.height - sourceAllocation.y2);
        }
        break;
    default:
        break;
    }
    return [direction, style];
}
