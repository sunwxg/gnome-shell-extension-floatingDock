const { Clutter, GObject, Shell, St } = imports.gi;

const PopupMenu = imports.ui.popupMenu;
const Main = imports.ui.main;

const PREVIEW_MAX_WIDTH = 250;
const PREVIEW_MAX_HEIGHT = 150;

var WindowPreviewMenu = class WindowPreviewMenu extends PopupMenu.PopupMenu {
    constructor(source) {
        //super(source, 0.5, St.Side.RIGHT);
        super(source, 0.5, St.Side.BOTTOM);

        //this.actor.set_style("max-height: 100px");
        this._source = source;

            let menuSection = new WindowPreviewMenuSection();
            this.addMenuItem(menuSection);

        //this._border = new St.DrawingArea();
        let themeNode = this._boxPointer.get_theme_node();
        let borderWidth = themeNode.get_length('-arrow-border-width');
        let base = themeNode.get_length('-arrow-base');
        let rise = themeNode.get_length('-arrow-rise');
        //print("wxg: arrow height=", this._boxPointer.get_surface_size());

        let sourceAllocation = Shell.util_get_transformed_allocation(source);
        print("wxg: sourceAllocation=", sourceAllocation.x1, sourceAllocation.y1);

        let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
        print("wxg: workarea=", workArea.x, workArea.y, workArea.width, workArea.height);
        //let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        //let verticalMargins = menuSection.actor.margin_top + menuSection.actor.margin_bottom;

        // The workarea and margin dimensions are in physical pixels, but CSS
        // measures are in logical pixels, so make sure to consider the scale
        // factor when computing max-height
        //let maxHeight = Math.round((workArea.height - verticalMargins) / scaleFactor);
        //menuSection.actor.style = 'max-height: %spx;'.format(maxHeight);
        //menuSection.actor.style = 'max-height: %spx;'.format(workArea.height);
        //menuSection.actor.style = 'max-width: %spx;'.format(workArea.width);
        let arrowHeight = (24 + 9 * 2 + 2); // -arrow-base + -arrow-border-radius*2 + -arrow-border-width*2
        menuSection.actor.style = 'max-height: %spx;'.format(sourceAllocation.y1 - workArea.y - arrowHeight);


        let windows = this._source.app.get_windows();
        for (let i in windows) {
            let menuItem = new WindowPreviewMenuItem(windows[i]);
            //this.addMenuItem(menuItem);
            print("wxg: menuItem=", menuItem);
          print("wxg: menuItem=", menuItem);
            menuSection.addMenuItem(menuItem);
        }

        //this._arrowSide = St.Side.LEFT;
        //this._boxPointer._arrowSide = St.Side.LEFT;
        //this._boxPointer._userArrowSide = St.Side.LEFT;

        Main.uiGroup.add_actor(this.actor);
    }

    popup() {
        print("wxg: popup");
            this.open();
    }
};

var WindowPreviewMenuSection = class WindowPreviewMenuSection extends PopupMenu.PopupMenuSection {
    constructor() {
        super();
        // Since a function of a submenu might be to provide a "More.." expander
        // with long content, we make it scrollable - the scrollbar will only take
        // effect if a CSS max-height is set on the top menu.
        this._scrollView = new St.ScrollView({
            //style_class: 'vfade',
            //overlay_scrollbars: true,
            x_expand: true, y_expand: true,
        });
        //this._scrollView.set_policy(St.PolicyType.AUTOMATIC, St.PolicyType.AUTOMATIC);
        this._scrollView.set_policy(St.PolicyType.ALWAYS, St.PolicyType.ALWAYS);

        this.actor = this._scrollView;
        this.actor.add_actor(this.box);
        this.actor._delegate = this;
        //this.box.set_vertical(false);
    }
};

var WindowPreviewMenuItem = GObject.registerClass(
class WindowPreviewMenuItem extends PopupMenu.PopupBaseMenuItem {
    _init(window, params) {
        super._init(params);

        this._cloneBin = new St.Bin();
        this._cloneBin.set_size(PREVIEW_MAX_WIDTH, PREVIEW_MAX_HEIGHT);
        this.add_child(this._cloneBin);

        this._cloneWindow(window);
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
        this._mutterWindow = mutterWindow;
        this._cloneBin.set_child(this._clone);
    }
});
