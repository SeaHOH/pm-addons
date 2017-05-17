"use strict";

let {classes: Cc, interfaces: Ci, utils: Cu} = Components;

Cu.import("resource://gre/modules/PopupNotifications.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/AddonManager.jsm");

var FireCaptor = {
    ww: Services.ww,       // nsIWindowWatcher
    wm: Services.wm,       // nsIWindowMediator

    get isWinNT() {
        var os = Services.appinfo.OS;
        return os == "WINNT" ? true : false;
    },

    first: false,

    aListener: {
        onOpenWindow: function (aWindow) {
            var win = aWindow.docShell.QueryInterface(
                      Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
            win.addEventListener("load", function __handleEvent__() {
                win.removeEventListener("load", __handleEvent__, false);
                FireCaptor.loadSubScript(this);
            }, false);
        },
        onCloseWindow: function (aWindow) {},
        onWindowTitleChange: function (aWindow, aTitle) {},
    },

    startup: function () {
        this.wm.addListener(this.aListener);
        var cw = this.ww.getWindowEnumerator();
        while (cw.hasMoreElements()) {
            var win = cw.getNext().QueryInterface(Ci.nsIDOMWindow);
            this.loadSubScript(win);
        }
    },
    shutdown: function () {
        this.wm.removeListener(this.aListener);
        var cw = this.ww.getWindowEnumerator();
        while (cw.hasMoreElements()) {
            var win = cw.getNext().QueryInterface(Ci.nsIDOMWindow);
            this.unloadSubScript(win);
            delete win.FireCaptor;
        }
    },

    pref: {
        init: function () {
            var p = {
                visiblePortion     : false,
                key_visiblePortion : "",
                code_visiblePortion: 0,
                completePage       : false,
                key_completePage   : "",
                code_completePage  : 0,
                selection          : false,
                key_selection      : "",
                code_selection     : 0,
                element            : false,
                key_element        : "",
                code_element       : 0
            }
            var branch = Services.prefs.getDefaultBranch("extensions.firecaptor.");

            // set firstRun defalut
            branch.setBoolPref("firstRun", true);

            for (let i in p) {
                var s = p[i];
                switch (typeof s) {
                    case "boolean" :
                        branch.setBoolPref(i, s);
                        break;
                    case "string" :
                        branch.setCharPref(i, s);
                        break;
                    case "number" :
                        branch.setIntPref(i, s);
                        break;
                }
            }
        },
        observe: function (aSubject, aTopic, aData) {
            if (aTopic != "nsPref:changed") return;
            var wins = [];
            var cw = Services.ww.getWindowEnumerator();
            while (cw.hasMoreElements()) {
                var win = cw.getNext().QueryInterface(Ci.nsIDOMWindow);
                wins.push(win);
            }
            aSubject.QueryInterface(Ci.nsIPrefBranch)
                    .QueryInterface(Ci.nsIPrefBranch2);
            switch (aSubject.getPrefType(aData)) {
                case aSubject.PREF_BOOL :
                    wins.forEach(function (item, index, array) {
                        if (item.FireCaptor && typeof item.FireCaptor[aData] != "undefined")
                            item.FireCaptor[aData] = aSubject.getBoolPref(aData);
                    });
                    break;
                case aSubject.PREF_INT :
                    wins.forEach(function (item, index, array) {
                        if (item.FireCaptor && typeof item.FireCaptor[aData] != "undefined")
                            item.FireCaptor[aData] = aSubject.getIntPref(aData);
                    });
                    break;
            }
        },
        register: function () {
            var aPrefs = Services.prefs;
            this._branch = aPrefs.getBranch("extensions.firecaptor.");
            this._branch.QueryInterface(Ci.nsIPrefBranch2);
            this._branch.addObserver("", this, false);
        },
        unregister: function () {
            if (!this._branch) return;
            this._branch.removeObserver("", this);
        }
    },

    loadSubScript: function (win) {
        Services.scriptloader.loadSubScript("resource://firecaptor/content/overlay.js",
                                            win,
                                            "UTF-8"
                                           );
        win.FireCaptor.init(this.first);
        this.first = true;
    },
    unloadSubScript: function (win) {
        let fc = win.FireCaptor;
        fc && fc.uninit && (typeof fc.uninit == "function") && fc.uninit();
    }
}

// 启用
function startup(data, reason) {
    FireCaptor.pref.init();
    FireCaptor.pref.register();
    var ios = Services.io;
    // 注册 resource://firecaptor/
    var resProtocolHandler = ios.getProtocolHandler("resource")
        .QueryInterface(Ci.nsIResProtocolHandler);
    if (!resProtocolHandler.hasSubstitution("firecaptor")) {
        var resURI = null;
        if (data.resourceURI) { // Gecko 7+
            resURI = data.resourceURI;
        } else {
            if (data.installPath.isDirectory()) {
                resURI = ios.newFileURI(data.installPath);
            } else { // unpacke
                var jarProtocolHandler = ios.getProtocolHandler("jar")
                    .QueryInterface(Ci.nsIJARProtocolHandler);
                var spec = "jar:" + ios.newFileURI(data.installPath).spec + "!/";
                resURI = jarProtocolHandler.newURI(spec, null, null);
            }
        }
        resProtocolHandler.setSubstitution("firecaptor", resURI);
    }

    FireCaptor.startup();
}

// 禁用或应用程序退出
function shutdown(data, reason) {
    /*
    if (reason == 4 || reason == 6) // ADDON_DISABLE || ADDON_UNINSTALL
        Cu.reportError("uninstalled");
    else
        Cu.reportError(reason);
    */
    FireCaptor.shutdown();
    FireCaptor.pref.unregister();
    var ios = Services.io;
    var resProtocolHandler = ios.getProtocolHandler("resource")
        .QueryInterface(Ci.nsIResProtocolHandler);
    if (resProtocolHandler.hasSubstitution("firecaptor"))
        resProtocolHandler.setSubstitution("firecaptor", null);
}

// 安装
function install(data, reason) {
}

// 卸载
function uninstall(data, reason) {
}
