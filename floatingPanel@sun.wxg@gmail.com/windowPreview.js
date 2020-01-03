const { Gtk, Clutter, GObject, Shell, St } = imports.gi;

const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Util = Me.imports.util;
const Extension = Me.imports.extension;
const NUMBER_TO_CHAR = Me.imports.util.NUMBER_TO_CHAR;

const DIRECTION = 'floating-panel-direction';

const PREVIEW_MAX_WIDTH = 250;
const PREVIEW_MAX_HEIGHT = 150;
//var ICON_SIZE = 48;

var WindowPreviewMenu = class WindowPreviewMenu extends PopupMenu.PopupMenu {
    constructor(source, iconSize) {
        let direction, style;
        [direction, style] = getDirectionStyle(source);
        super(source, 0.5, direction);
        this.actor.set_style(style);

        this.iconSize = iconSize;
        this._source = source;
        this._source.connect('destroy', () => {
            this.destroy();
        });

        if (source.vimMode) {
            this.sourceActor.disconnect(this._keyPressId);
            this._keyPressId = 0;
        }

        this.actor.hide();
        Main.uiGroup.add_actor(this.actor);
    }

    _redisplay() {
        this.removeAll();

        this._menuSection = new WindowPreviewMenuSection();
        this.addMenuItem(this._menuSection);

        let windows = this._source.app.get_windows();
        windows = windows.filter( (window) => {
            return Util.windowInActiveWorkspace(window);
        });
        let k = 0;
        for (let i in windows) {
            let menuItem = new WindowPreviewMenuItem(windows[i], this._source, k++);
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
    _init(window, button, number) {
        super._init({});

        this._window = window;
        this._button = button;
        this._number = number;

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
            this._cloneBox.add_child(this._createNumberIcon(this._number));

        this._cloneBin.set_child(this._cloneBox);

        this._mutterWindow = mutterWindow;
        this._mutterWindowId = this._mutterWindow.connect('destroy', () => {
            this.destroy();
            this._mutterWindowId = 0;
        });
    }

    _createNumberIcon(number) {
        print("wxg: number=", number);
        let icon = new St.Widget({ x_expand: true,
                                   y_expand: true,
                                   x_align:  Clutter.ActorAlign.START,
                                   y_align:  Clutter.ActorAlign.START });

        let box = new St.Widget();
        icon.add_child(box);

        let labelBox = new St.BoxLayout({ style_class: 'number-window',
                                          vertical: true });
        box.add_child(labelBox);

        let label = new St.Label({
            text: String.fromCharCode(Clutter.keysym_to_unicode(NUMBER_TO_CHAR[number])),
            x_align:  Clutter.ActorAlign.CENTER,
            y_align:  Clutter.ActorAlign.START,
        });
        labelBox.add_child(label);

        labelBox.set_size(this.iconSize * 0.5, this.iconSize * 0.5);
        box.set_size(this.iconSize * 0.5, this.iconSize * 0.5);
        return icon;
    }

    vfunc_button_press_event() {
        this._getTopMenu().close();
        Main.activateWindow(this._window);
        this._button.emit('activate-window');

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
    let sourceAllocation = Shell.util_get_transformed_allocation(source);
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
