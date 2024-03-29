import GObject from 'gi://GObject';
import Shell from 'gi://Shell';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as Util from './util.js';
import {CreateNumberIcon} from './numberIcon.js';

const SCHEMA = 'org.gnome.shell.extensions.floatingDock';
const DIRECTION = 'floating-dock-direction';

const PREVIEW_MAX_WIDTH = 250;
const PREVIEW_MAX_HEIGHT = 150;

export const WindowPreviewMenu = class WindowPreviewMenu extends PopupMenu.PopupMenu {
    constructor(source, iconSize, dir, settings) {
        let direction, style;
        [direction, style] = getDirectionStyle(source, settings);
        super(source, 0.5, direction);
        this.actor.set_style(style);

        this.iconSize = iconSize;
        this.dir = dir;
        this.settings = settings;
        this._source = source;

        this.actor.connectObject('captured-event',
            this._onCapturedEvent.bind(this), this);

        Main.uiGroup.add_child(this.actor);
        this.actor.hide();
    }

    _onCapturedEvent(actor, event) {
        if (event.type() === Clutter.EventType.KEY_PRESS) {
            let symbol = event.get_key_symbol();
            let number = Util.NUMBER_TO_CHAR.findIndex( (element) => {
                                                    return element == symbol; });
            if (number >= 0) {
                this.close(false);
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
            let menuItem = new WindowPreviewMenuItem(windows[i], this._source, k++, this.iconSize, this.dir);
            this._menuSection.addMenuItem(menuItem);
        }
    }

    popup() {
        this._redisplay();
        this.open();
    }
};

const WindowPreviewMenuSection = class WindowPreviewMenuSection extends PopupMenu.PopupMenuSection {
    constructor() {
        super();
        let scroll = new St.ScrollView({ hscrollbar_policy: St.PolicyType.NEVER,
                                         vscrollbar_policy: St.PolicyType.AUTOMATIC,
                                         enable_mouse_scrolling: true });
        this.actor = scroll;
        this.actor.add_child(this.box);
        this.actor._delegate = this;
    }
};

const WindowPreviewMenuItem = GObject.registerClass(
class WindowPreviewMenuItem extends PopupMenu.PopupBaseMenuItem {
    _init(window, button, number, iconSize, dir) {
        super._init({});

        this._window = window;
        this._button = button;
        this._number = number;
        this.iconSize = iconSize;
        this.dir = dir;

        if (button.vimMode) {
            this.setSensitive(false);
        }

        this._cloneBin = new St.Bin();
        this._cloneBin.set_size(PREVIEW_MAX_WIDTH, PREVIEW_MAX_HEIGHT);
        this.add_child(this._cloneBin);

        this._cloneWindow(window);

        this.actor.connectObject('captured-event',
            this._onCapturedEvent.bind(this), this);
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
            this._cloneBox.add_child(CreateNumberIcon(this._number, this.iconSize, this.dir));

        this._cloneBin.set_child(this._cloneBox);

        this._mutterWindow = mutterWindow;
        this._mutterWindowId = this._mutterWindow.connect('destroy', () => {
            this.destroy();
            this._mutterWindowId = 0;
        });
    }

    _onCapturedEvent(actor, event) {
        if (event.type() === Clutter.EventType.BUTTON_PRESS) {
            this._getTopMenu().close(false);
            this._button.activateWindow(this._window);
            return Clutter.EVENT_STOP;
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

function getDirectionStyle(source, settings) {
    const sourceAllocation = source.get_transformed_extents();
    let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
    // -arrow-base + -arrow-border-radius*2 + -arrow-border-width*2
    let arrowHeight = (24 + 9 * 2 + 2);

    let style = '';
    let direction;
    switch (Util.getPosition(settings.get_string(DIRECTION))) {
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
