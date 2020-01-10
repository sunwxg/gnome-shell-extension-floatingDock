PROJECT=floatingPanel@sun.wxg@gmail.com

schemas:
	glib-compile-schemas ${PROJECT}/schemas/
submit: schemas
	cd ${PROJECT}/ && zip -r ~/${PROJECT}.zip *

install:
	rm -rf ~/.local/share/gnome-shell/extensions/${PROJECT}
	cp -r ${PROJECT} ~/.local/share/gnome-shell/extensions/

