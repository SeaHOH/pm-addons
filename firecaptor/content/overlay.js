"use strict";

(function FC_init(window) {

let {classes: Cc, interfaces: Ci, utils: Cu} = Components;

let document = window.document, JSON = window.JSON;

Cu.import("resource://gre/modules/Services.jsm");

var FireCaptor = {
    isAustralis: parseInt(Services.appinfo.version) >= 29,
    get branch () {
        var aPrefs = Services.prefs;
        var _branch = aPrefs.getBranch("extensions.firecaptor.");
        return _branch;
    },
    conf: [
        "visiblePortion", "code_visiblePortion",
        "completePage", "code_completePage",
        "selection", "code_selection",
        "element", "code_element"
    ],

    btnId: "firecaptor-button",

    addbtn: function (first) {
        var gNavToolbox = gNavToolbox || document.getElementById("navigator-toolbox");
        if (!gNavToolbox) return;
        var browserToolbarPalette = gNavToolbox.palette;
        if (browserToolbarPalette.id != "BrowserToolbarPalette") return;

        this._browserToolbarPalette = browserToolbarPalette;

        var id = this.btnId;
        var self = this;

        function createButton(aDoc) {
            aDoc || (aDoc = document);
            var aWin = aDoc.defaultView;
            var toolbarbutton = aDoc.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "toolbarbutton");
            toolbarbutton.setAttribute("type", "menu");
            toolbarbutton.id = id;
            toolbarbutton.className = "toolbarbutton-1";
            toolbarbutton.setAttribute("label", "FireCaptor");
            toolbarbutton.setAttribute("tooltiptext", "FireCaptor");
            toolbarbutton.setAttribute("orient", "horizontal");
            toolbarbutton.setAttribute("removable", true);
            toolbarbutton.style.listStyleImage = "url('resource://firecaptor/skin/icon16.png')";
            var menupopup = aDoc.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "menupopup");
            var items = [
                {
                    label: "Capture Visible portion ...",
                    oncommand: "FireCaptor.doVisiblePortion();",
                    data_name: "visiblePortion"
                },
                {
                    label: "Capture Complete page ...",
                    oncommand: "FireCaptor.doCompletePage();",
                    data_name: "completePage",
                },
                {
                    label: "Capture Selection ...",
                    oncommand: "FireCaptor.doSelection();",
                    data_name: "selection"
                },
                {
                    label: "Capture Element ...",
                    oncommand: "FireCaptor.doElement();",
                    data_name: "element"
                }
            ];
            let SBS = {};
            Cu.import("resource://firecaptor/modules/StringBundle.jsm", SBS);
            const StringBundleService = SBS.StringBundleService;
            const PF = "resource://firecaptor/locale/overlay.properties";
            let bundle = StringBundleService(PF);
            items.forEach(function (item, index, array) {
                var menuitem = aDoc.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "menuitem");
                for (let i in item) {
                    let value = (i === "label" && bundle) ? bundle.GetStringFromName(item["data_name"]) + " ..."
                                                          : item[i];
                    menuitem.setAttribute(i, value);
                }
                menupopup.appendChild(menuitem);
            });
            toolbarbutton.appendChild(menupopup);
            toolbarbutton.addEventListener("click", function (e) {
                if (e.button != 2) return;
                var target = e.explicitOriginalTarget;
                if (target.localName != "menuitem") return;
                e.preventDefault();
                target.parentNode.hidePopup();
                var name = target.getAttribute("data_name");
                var title = bundle ? bundle.formatStringFromName("setting", [bundle.GetStringFromName(name)], 1)
                                   : name + " - key setting";
                var branch = self.branch;
                var data = {
                    name   : title,
                    enabled: branch.getBoolPref(name),
                    keychar: branch.getCharPref("key_" + name),
                    code   : branch.getIntPref("code_" + name),
                    apply  : bundle ? bundle.GetStringFromName("apply") : "apply"
                };
                /*
                 * 从 Firefox 17+ 起，通过 window.openDialog 传递的对象无法读取，
                 * 故此使用 JSON 格式作为数据传递格式。
                 */
                data = JSON.stringify(data);
                function apply(data) {
                    data = JSON.parse(data);
                    branch.setBoolPref(name, data.enabled);
                    branch.setCharPref("key_" + name, data.keychar);
                    branch.setIntPref("code_" + name, data.code);
                }
                aWin.openDialog("resource://firecaptor/content/keyconfig.html",
                                  "Firecaptor-keyconfig",
                                  "modal,chrome,centerscreen,dialog",
                                  data, apply
                );
            }, true);

            // 阻止 linux 下弹出默认右键菜单
            toolbarbutton.addEventListener("contextmenu", function (e) {
                e.preventDefault();
            }, true);

            return toolbarbutton;
        }

        if (this.isAustralis) {
            return first || this.buildForAustralis(createButton);
        }

        browserToolbarPalette.appendChild(createButton());

        if (this.branch.getBoolPref("firstRun")) {
            this.branch.setBoolPref("firstRun", false);
            const ABID = "addon-bar";
            var addonBar = document.getElementById(ABID);
            if (!addonBar) return;
            addonBar.insertItem(this.btnId, null, null, false);
            addonBar.setAttribute("currentset", addonBar.currentSet);
            document.persist(ABID, "currentset");
            //addonBar.collapsed = false;
        } else {
            var toolbars = document.querySelectorAll("toolbar[currentset]");
            if (toolbars.length == 0) return;
            for (var i = 0, len = toolbars.length; i < len; i++) {
                var toolbar = toolbars[i];
                var currentSet = toolbar.getAttribute("currentset");
                if (!currentSet) continue;
                if (currentSet.split(",").some(function (item) {
                    return item == this.btnId;
                }, this)) {
                    toolbar.currentSet = currentSet;
                    try {
                        // 调用该函数可能会导致地址栏与搜索栏之间的
                        // splitter#urlbar-search-splitter 被移除
                        //BrowserToolboxCustomizeDone(true);
                    } catch (ex) {
                        Cu.reportError(ex);
                    }
                    break;
                }
            }
        }
    },
    buildForAustralis: function (createButton) {
        let {CustomizableUI} = Components.utils.import("resource:///modules/CustomizableUI.jsm");
        var wrapper = CustomizableUI.createWidget({
            id: this.btnId,
            type: "custom",
            onBuild: createButton,
            defaultArea: CustomizableUI.AREA_NAVBAR
        });
    },
    unBuildForAustralis: function (id) {
        let {CustomizableUI} = Components.utils.import("resource:///modules/CustomizableUI.jsm");
        CustomizableUI.destroyWidget(id);
    },

    doVisiblePortion: function () {
        this.selectwin(false);
    },

    doCompletePage: function () {
        this.selectwin(true);
    },

    selectwin: function (full) {
        var div = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
        div.style.cssText = ""
            + "position: fixed; top: 0; left: 0; width: 0; height: 0; "
            + "margin: 0; padding: 0; z-index: 99999; "
            + "background-color: rgba(113, 144, 152, 0.5); "
            + "pointer-events: none; ";
        var parent = document.body || document.documentElement;
        parent.appendChild(div);

        var rect = {x: 0, y: 0, w: 0, h: 0};
        var getRoot = {
            "BackCompat": function (doc) { return doc.body },
            "CSS1Compat": function (doc) { return doc.documentElement },
            "undefined": function (doc) { return doc.documentElement }
        };

        function updatediv(x, y, w, h) {
            div.style.left = x + "px";
            div.style.top = y + "px";
            div.style.width = w + "px";
            div.style.height = h + "px";
        }
        var prewin = null;
        function sel(e) {
            switch (e.type) {
                case "mouseover" :
                    if (prewin == e.view) return;
                    prewin = e.view;
                    let doc = prewin.document;
                    let root = getRoot[doc.compatMode](doc);
                    var x = window.mozInnerScreenX - prewin.mozInnerScreenX;
                    var y = window.mozInnerScreenY - prewin.mozInnerScreenY;
                    rect.w = root.clientWidth;
                    rect.h = root.clientHeight;
                    updatediv(Math.abs(x), Math.abs(y), rect.w, rect.h);
                    break;
                case "mouseout" :
                    if (e.relatedTarget == null) {
                        updatediv(0, 0, 1, 1);
                        prewin = null;
                    }
                    break;
            }
        }
        function key(e) {
            if (e.keyCode == e.DOM_VK_ESCAPE) {
                cls();
            } else if (e.keyCode == e.DOM_VK_RETURN || e.keyCode == e.DOM_VK_ENTER) {
                cli(e);
            }
        }
        function cls() {
            window.removeEventListener("mouseover", sel, false);
            window.removeEventListener("mouseout", sel, false);
            window.removeEventListener("keydown", key, true);
            window.removeEventListener("click", cli, false);
            div.parentNode.removeChild(div);
        }
        function cli(e) {
            e.preventDefault();
            e.stopPropagation();
            cls();
            var win = e.view;
            if (full) {
                let doc = win.document;
                let rootElement = getRoot[doc.compatMode](doc);
                rect.w = Math.max(rootElement.scrollWidth, rootElement.clientWidth);
                rect.h = Math.max(rootElement.scrollHeight, rootElement.clientHeight);
            } else {
                rect.x = win.pageXOffset;
                rect.y = win.pageYOffset;
            }

            return FireCaptor.save(rect, win, e.ctrlKey, e.shiftKey);
        }
        window.addEventListener("mouseover", sel, false);
        window.addEventListener("mouseout", sel, false);
        window.addEventListener("keydown", key, true);
        window.addEventListener("click", cli, false);
    },

    doSelection: function () {

        function LightBox() {
            this.bindFn = function (type, listener, userCapture) {
                if (typeof type != "string" || typeof listener != "function") return;
                var fn = listener.bind(this);
                userCapture = userCapture ? true : false;
                var evt = {
                    type: type,
                    fn: fn,
                    userCapture: userCapture
                };
                if (!Array.isArray(this._fns))
                    this._fns = [];
                this._fns.push(evt);
            };
            this.init = function () {
                var div = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
                if (!div) return;
                var width = Math.max(document.documentElement.scrollWidth,
                                     document.documentElement.clientWidth);
                var height = Math.max(document.documentElement.scrollHeight,
                                      document.documentElement.clientHeight);
                div.style.cssText = ""
                    + "position: fixed; border: 0px solid rgba(113, 144, 152, 0.5); "
                    + "top: 0; right: 0; bottom: 0; left: 0; "
                    + "margin: 0; padding: 0; "
                    + "z-index: 99999; "
                    + "border-left-width: " + width + "px; "
                    + "border-top-width: " + height + "px; ";
                var span = document.createElementNS("http://www.w3.org/1999/xhtml", "span");
                span.style.cssText = ""
                    + "position: absolute; top: 0; left: 0;"
                    + "margin: 0; padding: 0 3px; z-index: 1; cursor: default; -moz-user-select: none;"
                    + "font-size: 11px; color: blue; background: rgba(200, 200, 200, 0.6);"
                    + "white-space: nowrap; border-bottom-right-radius: 3px;"
                this._sizeBox = div.appendChild(span);
                var parent = document.body || document.documentElement;
                var subDiv = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
                if (subDiv) {
                    subDiv.style.cssText = ""
                        + "width: 100%; height: 100%; margin: 0; padding: 0; "
                        + "-moz-box-sizing: border-box; box-sizing: border-box; ";
                    this._subBox = div.appendChild(subDiv);
                }
                this.box = parent.appendChild(div);
                this.width = width;
                this.height = height;
                if (this._fns) {
                    this._fns.forEach(function (item, index, array) {
                        div.addEventListener(item.type, item.fn, item.userCapture);
                    });
                }
                div.addEventListener("mousedown", this, false);
                this.rect = {x: 0, y: 0, w: 0, h: 0};
            };
            this.handleEvent = function (e) {
                e.preventDefault();
                e.stopPropagation();
                var _box = e.currentTarget;
                switch (e.type) {
                    case "mousedown" :
                        this.x = e.clientX;
                        this.y = e.clientY;
                        _box.style.borderLeftWidth = this.x + "px";
                        _box.style.borderTopWidth = this.y + "px";
                        _box.style.borderRightWidth = this.width - this.x + "px";
                        _box.style.borderBottomWidth = this.height - this.y + "px";
                        _box.style.width = "0px";
                        _box.style.height = "0px";
                        this._subBox.style.border = "none";
                        this._sizeBox.textContent = "";
                        var self = this;
                        this._tid = setTimeout(function () {
                            self._tid = 0;
                            _box.addEventListener("mousemove", self, false);
                        }, 150);
                        _box.addEventListener("mouseup", this, false);
                        break;
                    case "mousemove" :
                        var x = e.clientX, y = e.clientY;
                        _box.setCapture(true);
                        _box.style.borderLeftWidth = Math.min(x, this.x) + "px";
                        _box.style.borderTopWidth = Math.min(y, this.y) + "px";
                        _box.style.borderRightWidth = this.width - Math.max(x, this.x) + "px";
                        _box.style.borderBottomWidth = this.height - Math.max(y, this.y) + "px";
                        let _w = Math.abs(x - this.x),
                            _h = Math.abs(y - this.y);
                        _box.style.width = _w + "px";
                        _box.style.height = _h + "px";
                        this._subBox.style.border = "1px dashed rgba(0, 0, 0, 0.6)";
                        this._sizeBox.textContent = _w + ',' + _h;
                        break;
                    case "mouseup" :
                        if (this._tid) {
                            clearTimeout(this._tid);
                            this._tid = 0;
                        } else {
                            _box.removeEventListener("mousemove", this, false);
                            document.releaseCapture();
                            var x = parseFloat(_box.style.borderLeftWidth),
                                y = parseFloat(_box.style.borderTopWidth),
                                w = parseFloat(_box.style.width),
                                h = parseFloat(_box.style.height);
                            this.rect = {x: x, y: y, w: w, h: h};
                        }
                        _box.removeEventListener("mouseup", this, false);
                        break;
                }
            };
            this.uninit = function () {
                if (this.box) {
                    this.box.removeEventListener("mousedown", this, false);
                    if (this._fns) {
                        this._fns.forEach(function (item, index, array) {
                            this.box.removeEventListener(item.type, item.fn, item.userCapture);
                        }, this);
                        delete this._fns;
                    }
                    this.box.parentNode.removeChild(this.box);
                    delete this.box;
                    this._subBox && (delete this._subBox);
                    this._sizeBox && (delete this._sizeBox);
                }
            };
        }

        var box = new LightBox();
        var self = this;
        function grab(e) {
            this.uninit();
            box = null;
            return self.save(this.rect, null, e.ctrlKey, e.shiftKey);
        }
        window.addEventListener("keydown", function __handleEvent__(e) {
            if (box == null)
                return window.removeEventListener("keydown", __handleEvent__, true);
            if (e.keyCode == e.DOM_VK_ESCAPE) {
                box.uninit();
                box = null;
                window.removeEventListener("keydown", __handleEvent__, true);
            } else if (e.keyCode == e.DOM_VK_RETURN || e.keyCode == e.DOM_VK_ENTER) {
                grab.apply(box, [e]);
                box = null;
                window.removeEventListener("keydown", __handleEvent__, true);
            }
        }, true);
        box.bindFn("dblclick", grab, false);
        box.init();
    },

    doElement: function () {

        function SelectElementWithMouse(cb, start) {
            if (!(this instanceof SelectElementWithMouse))
                return SelectElementWithMouse(cb);

            if ("function" === typeof cb)
                this.afterCompleteCallback = cb;

            if (!!start)
                this.inspect();

            return this;
        }
        SelectElementWithMouse.prototype = {
            constructor: SelectElementWithMouse,
            inspect: function () {
                window.addEventListener("mouseover", this, false);
                window.addEventListener("mousedown", this, true);
                window.addEventListener("mouseup", this, true);
                window.addEventListener("keyup", this, true);
                window.addEventListener("click", this, true);
                var elem = document.createElementNS("http://www.w3.org/1999/xhtml", "div");
                elem.style.cssText = [
                    "display: block; width: 0; height: 0",
                    "position: fixed; top: 0; left: 0",
                    "background: rgba(113, 144, 152, 0.5)",
                    "border: 1px dashed rgba(0, 0, 0, 0.5)",
                    "pointer-events: none",
                    "transition: left 0.08s ease-in 0s, top 0.08s ease-in 0s"
                ].join(";");
                this._inspector = document.documentElement.appendChild(elem);
            },
            complete: function (rect) {
                window.removeEventListener("mouseover", this, false);
                window.removeEventListener("mousedown", this, true);
                window.removeEventListener("mouseup", this, true);
                window.removeEventListener("keyup", this, true);
                window.removeEventListener("click", this, true);
                if (rect && this.afterCompleteCallback) {
                    this.afterCompleteCallback.apply(this, arguments);
                }
                this._inspector.parentNode.removeChild(this._inspector);
                delete this._inspector;
            },
            handleEvent: function (evt) {
                switch (evt.type) {
                    case "mouseover":
                        cancel(evt);
                        if (true) {
                            let x = evt.mozMovementX || evt.movementX || 0,
                                y = evt.mozMovementY || evt.movementY || 0,
                                elem = evt.target;
                            wrapElement.bind(this)(x, y, elem);
                        }
                        break;
                    case "click":
                        cancel(evt);
                        this.complete(this.rect, evt.ctrlKey, evt.shiftKey);
                        break;
                    case "keyup":
                        if (true) {
                            let code = evt.keyCode,
                                ctrl = evt.ctrlKey,
                                shift = evt.shiftKey;
                            switch (code) {
                                case 13:
                                    cancel(evt);
                                    this.complete(this.rect, ctrl, shift);
                                    break;
                                case 27:
                                    cancel(evt);
                                    this.complete();
                                    break;
                            }
                        }
                        break;
                    default:
                        cancel(evt);
                }
                function cancel() {
                    evt.preventDefault();
                    evt.stopPropagation();
                    evt.stopImmediatePropagation && evt.stopImmediatePropagation();
                }
                function wrapElement(x, y, elem) {
                    var doc = elem.ownerDocument, win = doc.defaultView;
                    this._window = win;
                    var wrap = document.elementFromPoint(x, y);
                    var rect = elem.getBoundingClientRect();
                    var width = rect.width, height = rect.height;
                    x = rect.left, y = rect.top;
                    if (wrap && wrap !== elem) {
                        let rect = wrap.getBoundingClientRect();
                        x += rect.left, y += rect.top;
                    }
                    var frameWin = win;
                    while (true) {
                        if (frameWin.parent === frameWin || !frameWin.frameElement)
                            break;
                        let frameRect = frameWin.frameElement.getBoundingClientRect();
                        let {top, left} = getIframeContentOffset(frameWin.frameElement);
                        y += frameRect.top + top;
                        x += frameRect.left + left;
                        frameWin = frameWin.parent;
                    }
                    var inspector = this._inspector;
                    inspector.style.top = y + "px";
                    inspector.style.left = x + "px";
                    inspector.style.width = Math.max(0, width - 2) + "px";
                    inspector.style.height = Math.max(0, height - 2) + "px";

                    this._x = Math.round(rect.left + win.pageXOffset), this._y = Math.round(rect.top + win.pageYOffset), this._width = Math.round(width), this._height = Math.round(height);

                    function getIframeContentOffset(aIframe) {
                        var style = aIframe.ownerDocument.defaultView.getComputedStyle(aIframe, null);
                        if (!style) {
                            return {
                                top: 0,
                                left: 0
                            };
                        }
                        var paddingTop = parseInt(style.getPropertyValue("padding-top")),
                            paddingLeft = parseInt(style.getPropertyValue("padding-left")),
                            
                            borderTop = parseInt(style.getPropertyValue("border-top-width")),
                            borderLeft = parseInt(style.getPropertyValue("border-left-width"));

                        return {
                            top: borderTop + paddingTop,
                            left: borderLeft + paddingLeft
                        };
                    }
                }
            },
            get rect() {
                return {
                    window: this._window,
                    x: this._x,
                    y: this._y,
                    width: this._width,
                    height: this._height
                };
            }
        };

        let self = this;
        new SelectElementWithMouse(function (rect, toClipboard, silent) {
            self.save(
                { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
                rect.window,
                toClipboard,
                silent
            );
        }, true);

    },

    save: function (rect, win, toClip, silent, imagetype) {
        win = win || window;
        var x = rect.x || 0,
            y = rect.y || 0,
            w = rect.w || 0,
            h = rect.h || 0;
        var canvas = document.createElementNS("http://www.w3.org/1999/xhtml", "canvas");
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        canvas.width = w;
        canvas.height = h;

        try {
            var ctx = canvas.getContext("2d");
            ctx.clearRect(0, 0, w, h);
            ctx.save();
            ctx.drawWindow(win, x, y, w, h, "rgba(255, 255, 255, 0)");
            ctx.restore();
        } catch (ex) {
            alert("could not create the image, because the web page is too big!");
            return;
        }

        if (toClip) {
            return this.toClipboard(canvas, imagetype);
        }

        if (silent && this._lastSavePath) {
            var exname = this._imagetype.replace("image/", "");
            var filename = new Date().getTime() + "." + exname;
            var savePath = this._lastSavePath.clone();
            savePath.append(filename);
            "XULBrowserWindow" in window && XULBrowserWindow.setOverLink("Saving: "
                                            + savePath.path, null);
            return this.saveImage(canvas, savePath, this._imagetype);
        }
        var filePicker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
        var imagetypes = ["image/png", "image/jpeg"];
        filePicker.appendFilter("png", "*.png");
        filePicker.appendFilter("jpeg (only Gecko 7.0+)", "*.jpeg");
        if (true) {
            let exname = this._imagetype ? this._imagetype.replace("image/", "") : "png";
            filePicker.defaultExtension = "." + exname;
            filePicker.defaultString = new Date().getTime() + "." + exname;
            let i = (function () {
                for (let i = 0; i < imagetypes.length; i++) {
                    let value = imagetypes[i];
                    if (value.indexOf(exname) != -1) return i;
                }
                return 0;
            })();
            filePicker.filterIndex = i;
        }
        filePicker.init(window, "Save Image...", filePicker.modeSave);
        var result = filePicker.show();
        if (result == filePicker.returnOK || result == filePicker.returnReplace) {
            this._lastSavePath = filePicker.file.parent;
            this._imagetype = imagetypes[filePicker.filterIndex];
            return this.saveImage(canvas, filePicker.file, imagetypes[filePicker.filterIndex]);
        }
    },

    toClipboard: function (canvas, imagetype) {
        var clipboard = Cc["@mozilla.org/widget/clipboardhelper;1"]
                           .getService(Ci.nsIClipboardHelper);
        clipboard.copyString(canvas.toDataURL(imagetype ? imagetype : (this._imagetype ? this._imagetype : "image/png")));
        var title = "FireCaptor";
        var text = "success copy to clipboard!";
        try {
            Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService).
                showAlertNotification(null, title, text, false, "", null);
        } catch (ex) {
            var win = Services.ww.openWindow(null,
                                             "chrome://global/content/alerts/alert.xul",
                                             "_blank",
                                             "chrome,titlebar=no,popup=yes",
                                             null
                                            );
            win.arguments = [null, title, text, false, ""];
        }
    },

    saveImage: function (canvas, file, imagetype) {
        // create a data url from the canvas and then create URIs of the source and targets    
        var ios = Services.io;
        var source = ios.newURI(canvas.toDataURL(imagetype, ""), "UTF8", null);  
        //var target = ios.newFileURI(file)  
        
        if (this.isAustralis) {
            return this.downloadImage(source, file);
        }
            
        // prepare to save the canvas data  
        var persist = Cc["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(Ci.nsIWebBrowserPersist);  
        persist.persistFlags = Ci.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES;  
        persist.persistFlags |= Ci.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;  
          
        /*
        // displays a download dialog (remove these 3 lines for silent download)  
        var xfer = Components.classes["@mozilla.org/transfer;1"]  
                             .createInstance(Components.interfaces.nsITransfer);  
        xfer.init(source, target, "", null, null, null, persist);  
        persist.progressListener = xfer;  
        */

        // save the canvas data to the file  
        persist.saveURI(source, null, null, null, null, null, file, null);  
    },
    downloadImage: function (source, target) {
        let {Downloads} = Cu.import("resource://gre/modules/Downloads.jsm", {});
        return Downloads.createDownload({source, target}).then(function (download) {
            return download.start();
        }).then(function () {
            var title = "FireCaptor";
            var text = "Save " + target.path + " success!";
            notification(title, text);
        }).catch(function () {
            var title = "FireCaptor";
            var text = "Save fail!";
            notification(title, text);
        });
        function notification(title, text) {
            try {
                Cc["@mozilla.org/alerts-service;1"].getService(Ci.nsIAlertsService).
                    showAlertNotification(null, title, text, false, "", null);
            } catch (ex) {
                var win = Services.ww.openWindow(null,
                                                 "chrome://global/content/alerts/alert.xul",
                                                 "_blank",
                                                 "chrome,titlebar=no,popup=yes",
                                                 null
                                                );
                win.arguments = [null, title, text, false, ""];
            }

        }
    },

    init: function (first) {
        this.conf.forEach(function (item, index, array) {
            this[item] = item.indexOf("code_") == 0 ? this.branch.getIntPref(item)
                                                    : this.branch.getBoolPref(item);
        }, this);
        if (document.documentElement.getAttribute("windowtype") == "navigator:browser")
            this.addbtn(first);
        window.addEventListener("keydown", this, true);
    },

    handleEvent: function (e) {
        var key = e.keyCode || e.which;
        var keyMod = e.altKey | e.ctrlKey << 1 | e.shiftKey << 2 | e.metaKey << 3;
        var code = key | keyMod << 8;
        if (code == this.code_visiblePortion && this.visiblePortion) {
            e.preventDefault();
            this.doVisiblePortion();
        } else if (code == this.code_completePage && this.completePage) {
            e.preventDefault();
            this.doCompletePage();
        } else if (code == this.code_selection && this.selection) {
            e.preventDefault();
            this.doSelection();
        } else if (code == this.code_element && this.element) {
            e.preventDefault();
            this.doElement();
        }
    },

    uninit: function () {
        if (this.isAustralis) {
            this.unBuildForAustralis(this.btnId);
        } else {
            var fbt = document.getElementById(this.btnId);
            if (fbt) {
                fbt.parentNode.removeChild(fbt);
            } else if (this._browserToolbarPalette) {
                for each (node in this._browserToolbarPalette) {
                    if (node.id == this.btnId) {
                        this._browserToolbarPalette.removeChild(node);
                        break;
                    }
                }
            }
        }
        window.removeEventListener("keydown", this, true);
    }
};

return window.FireCaptor = FireCaptor;

})(window);
