// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-

const { Clutter, Gtk, Meta, Shell } = imports.gi;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const Main = imports.ui.main;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const DockBox = Me.imports.dockBox.DockBox;
const Util = Me.imports.util;

const SCHEMA = 'org.gnome.shell.extensions.floatingDock';
const HOTKEY = 'floating-dock-hotkey';
const DIRECTION = 'floating-dock-direction';
const ICON_SIZE = 'floating-dock-icon-size';
const ICON_FILE = 'floating-dock-icon-file';


class FloatDock {
    constructor() {
        this._gsettings = ExtensionUtils.getSettings(SCHEMA);

        let params = {direction: Util.getPosition(this._gsettings.get_string(DIRECTION)),
                      iconSize: this._gsettings.get_int(ICON_SIZE),
                      settings: this._gsettings };

        this.dockBox = new DockBox(params);

        this.directionID = this._gsettings.connect("changed::" + DIRECTION, () => {
            params.direction = Util.getPosition(this._gsettings.get_string(DIRECTION));
            this.dockBox.destroy();
            this.dockBox = new DockBox(params);
        });

        this.iconsizeID = this._gsettings.connect("changed::" + ICON_SIZE, () => {
            params.iconSize = this._gsettings.get_int(ICON_SIZE);
            this.dockBox.destroy();
            this.dockBox = new DockBox(params);
        });

        this._addKeybinding();
    }

    _addKeybinding() {
        let ModeType = Shell.hasOwnProperty('ActionMode') ?
                       Shell.ActionMode : Shell.KeyBindingMode;

        Main.wm.addKeybinding(HOTKEY,
                              this._gsettings,
                              Meta.KeyBindingFlags.NONE,
                              ModeType.ALL,
                              () => { this.dockBox.vimShow(); });
    }

    destroy() {
        this._gsettings.disconnect(this.directionID);
        this._gsettings.disconnect(this.iconsizeID);
        Main.wm.removeKeybinding(HOTKEY);
        this.dockBox.destroy();
    }
}

let floatDock;
let _startupPreparedId = 0;

function init(metadata) {
}

function enable() {
    // wait until the startup process has ended
    if (Main.layoutManager._startingUp)
        _startupPreparedId = Main.layoutManager.connect('startup-complete', () => enableFloatDock());
    else
        enableFloatDock();
}

function enableFloatDock() {
    if (_startupPreparedId)
        Main.layoutManager.disconnect(_startupPreparedId);
    _startupPreparedId = 0;

    floatDock = new FloatDock();
}

function disable() {
    floatDock.destroy();
    floatDock = null;
}
