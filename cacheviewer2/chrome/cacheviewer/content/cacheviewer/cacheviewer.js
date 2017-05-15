/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
const { classes: Cc, interfaces: Ci, utils: Cu, results: Cr } = Components;

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/LoadContextInfo.jsm");

function getMainWindow() {
  var windowManager = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService();
  var windowManagerInterface = windowManager.QueryInterface(Components.interfaces.nsIWindowMediator);
  var eb = windowManagerInterface.getEnumerator("navigator:browser");
  if (eb.hasMoreElements()) {
    return eb.getNext().QueryInterface(Components.interfaces.nsIDOMWindow);
  }
  return null;
}
function getBrowser() {
  return getMainWindow().getBrowser();
}
function switchCacheViewer() {
	var pref = Components.classes["@mozilla.org/preferences-service;1"]
				.getService(Components.interfaces.nsIPrefBranch);
	var sepwin = !(pref.getBoolPref("extensions.cacheviewer2.open_in_separate_window"));
	pref.setBoolPref("extensions.cacheviewer2.open_in_separate_window",sepwin);
	var needToOpen = true;
	var windowType = "CacheViewer";
	if (sepwin) {
		//remove tab
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
					.getService(Components.interfaces.nsIWindowMediator);
		var windows = wm.getEnumerator(windowType);
		while (windows.hasMoreElements()) {
			var theEM = windows.getNext().QueryInterface(Components.interfaces.nsIDOMWindow);
			if (theEM.document.documentElement.getAttribute("windowtype") == windowType) {
				theEM.focus();
				needToOpen = false;
	 			break;
			}
		}
		var nwnd = null;
		if (needToOpen) {
			const EMURL = "chrome://cacheviewer/content/cacheviewer.xul";
			const EMFEATURES = "";
			nwnd = window.openDialog(EMURL, "dlg", EMFEATURES);
		}
		var tab = getBrowser().mTabContainer.firstChild;
		while (tab) {
			if (getBrowser().getBrowserForTab(tab).contentDocument.documentElement.getAttribute("windowtype") == windowType) {
				getBrowser().removeTab( tab );
				break;
			}
			tab = tab.nextSibling;
		}
	} else {
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
					.getService(Components.interfaces.nsIWindowMediator);
		var windows = wm.getEnumerator(windowType);
		while (windows.hasMoreElements()) {
			var theEM = windows.getNext().QueryInterface(Components.interfaces.nsIDOMWindow);
			if (theEM.document.documentElement.getAttribute("windowtype") == windowType) {
				theEM.close();
	 			break;
			}
		}
		var tab = getBrowser().mTabContainer.firstChild;
		while (tab) {
			if (getBrowser().getBrowserForTab(tab).contentDocument.documentElement.getAttribute("windowtype") == windowType) {
				getBrowser().selectedTab = tab;
				needToOpen = false;
				break;
			}
			tab = tab.nextSibling;
		}
		if (needToOpen) {
			getBrowser().selectedTab = getBrowser().addTab("chrome://cacheviewer/content/cacheviewer.xul");
		}
	}
}
var CacheViewer = {
	
	// ***** Members *****
	_tree: null,
	_bundle: null,
	
	_DBConn: null,
	_rdf: null,
	_root: null,
	_metaData: "",
	_isLoading: false,
	_entries: null,
	_mapUri:null,

	get _cacheService() {
		if (!this.__cacheService) {
			this.__cacheService = Cc["@mozilla.org/netwerk/cache-storage-service;1"]
							.getService(Ci.nsICacheStorageService);
		}
		return this.__cacheService;
	},
	__cacheService: null,
	
	get _dateService() {
		if (!this.__dateService) {
			this.__dateService = Cc["@mozilla.org/intl/scriptabledateformat;1"]
							.getService(Ci.nsIScriptableDateFormat);
		}
		return this.__dateService;
	},
	__dateService: null,
	
	_log: function CV__log(aMessage) {
		if (this._DEBUG)
			Services.console.logStringMessage("[CacheViewer2] "+aMessage);
	},
	// ***** CacheViewer *****
	init: function CV_init() {
		var self = this;
		this._tree = document.getElementById("cacheTree");
		this._bundle = document.getElementById("infostrings");
		document.getElementById("swbtn").disabled = true;
		this._delEntryList = [];
		this._saveEntryList = [];
		this._mapUri = [];
		this._rdf = new RDF();
		this._root = this._rdf.makeSeqContainer(this._rdf.RDF_ITEM_ROOT);
		
		this._tree.database.AddDataSource(this._rdf.datasource);
		this._tree.setAttribute("ref", this._rdf.RDF_ITEM_ROOT);
		
		document.getElementById("search").setAttribute("type", "search");
		document.getElementById("searchtype").setAttribute("type", "search");
		document.getElementById("searchsize").setAttribute("type", "search");

		this._DBConn = Cc["@mozilla.org/storage/service;1"]
						.getService(Ci.mozIStorageService)
						.openSpecialDatabase("memory");
		if (this._DBConn.tableExists("cacheentries")) {
			this._DBConn.executeSimpleSQL("DROP TABLE cacheentries");
		}
		this._DBConn.createTable("cacheentries", "id INTEGER PRIMARY KEY, key TEXT, size INTEGER, type TEXT");
		this._entries = new Array();

		var timer = Components.classes["@mozilla.org/timer;1"].createInstance(Components.interfaces.nsITimer);
		var it = null;

		var keyProperty = this._rdf.getResource(this._rdf.NS_CACHEVIEWER+"key");
		var sizeProperty = this._rdf.getResource(this._rdf.NS_CACHEVIEWER+"size");
		var typeProperty = this._rdf.getResource(this._rdf.NS_CACHEVIEWER+"type");
		var devProperty = this._rdf.getResource(this._rdf.NS_CACHEVIEWER+"dev");
		var fetProperty = this._rdf.getResource(this._rdf.NS_CACHEVIEWER+"fet");
		var expProperty = this._rdf.getResource(this._rdf.NS_CACHEVIEWER+"exp");
		document.getElementById("previewImage").src = "chrome://cacheviewer/content/loading.gif";
		document.getElementById("cacheInfo").value = "\n\n\nLoading...";
		// local cache
		this._toggleButton(this._isLoading = true);
		this._DBConn.beginTransaction();
		this._rdf.datasource.beginUpdateBatch();
		var ds = this._rdf.datasource;
		var rs = this._rdf.rdfService;
		function mime_timerCallback() {}
		function item_timerCallback() {}
		item_timerCallback.prototype = {
			observe: function(aTimer, aTopic, aData) {
				try {
					var [index, value] = it.next();
				} catch(e) {
					self._DBConn.commitTransaction();
					self._rdf.datasource.endUpdateBatch();
					self._tree.builder.rebuild();
					self._toggleButton(self._isLoading = false);
					document.getElementById("search").focus();
					document.getElementById("swbtn").disabled = false;
					document.getElementById("previewImage").src = "";
					document.getElementById("cacheInfo").value = "";
					self._updateCount()
					//update mime type
					it = new Iterator(self._entries);
					timer.init(new mime_timerCallback(), 0.1, timer.TYPE_ONE_SHOT);
					return;
				}
				var resource = rs.GetResource(index);
				self._root.AppendElement(resource);
				ds.Assert(resource, keyProperty, rs.GetLiteral(value[0]), true);
				ds.Assert(resource, sizeProperty, rs.GetIntLiteral(value[1]), true);
				ds.Assert(resource, devProperty, rs.GetLiteral(value[2]), true);
				ds.Assert(resource, fetProperty, rs.GetDateLiteral(value[3]), true);
				ds.Assert(resource, expProperty, rs.GetDateLiteral(value[4]), true);
				self._DBConn.executeSimpleSQL("INSERT INTO cacheentries (id, key, size) VALUES (" + index + ", '" + value[0] + "', '" + value[1] + "')");
				timer.init(new item_timerCallback(), 0, timer.TYPE_ONE_SHOT);
			}
		};
		mime_timerCallback.prototype = {
			observe: function(aTimer, aTopic, aData) {
				try {
					var [index, value] = it.next();
				} catch(e) {
					self._entries = null;
					return;
				}
				var resource = rs.GetResource(index);
				var delay = 0
				// inline getMimeType
				try {
					var storage = self._cacheService.diskCacheStorage(LoadContextInfo.default,false);
					storage.asyncOpenURI(
						self._mapUri[value[0]],
						"",
						Ci.nsICacheStorage.OPEN_READONLY,
						{
							onCacheEntryCheck: function (entry, appcache) {
								return Ci.nsICacheEntryOpenCallback.ENTRY_WANTED;
							},
							onCacheEntryAvailable: function (entry, isnew, appcache, status) {
								if(status != Components.results.NS_OK)
								{
									ds.Assert(resource, typeProperty, rs.GetLiteral("-"), true);
									timer.init(new mime_timerCallback(), delay, timer.TYPE_ONE_SHOT);
									return;
								}
								entry.metaDataReady();
								try {
									var head = entry.getMetaDataElement("response-head");
								} catch(e) {
									ds.Assert(resource, typeProperty, rs.GetLiteral("-"), true);
									timer.init(new mime_timerCallback(), delay, timer.TYPE_ONE_SHOT);
									return;
								}
								// Don't use RegExp
								var type = "-";
								var a = head.indexOf("Content-Type: ");
								if (a > 0) {
									var b = head.indexOf("\n", a+14);
									type = head.substring(a+14, b-1);
									
									b = type.indexOf(";");
									if (b > 0) {
										type = type.substring(0, b);
									}
								}
								ds.Assert(resource, typeProperty, rs.GetLiteral(type), true);
								self._DBConn.executeSimpleSQL("UPDATE cacheentries SET type = '"+ type +"' WHERE id = "+ index);
								timer.init(new mime_timerCallback(), delay, timer.TYPE_ONE_SHOT);
							}
						}
					);
				} catch(e) {
					ds.Assert(resource, typeProperty, rs.GetLiteral("-"), true);
					timer.init(new mime_timerCallback(), delay, timer.TYPE_ONE_SHOT);
					return;
				}
			}
		};
		
		// ***** nsICacheStorageVisitor *****
		var disk_visitor = {
			onCacheStorageInfo: function (aEntryCount, aConsumption, aCapacity, aDiskDirectory) {
				var aDeviceID = "disk";
				document.getElementById(aDeviceID).setAttribute("value", Math.round(aConsumption/1024000*100)/100+"/"+Math.round(aCapacity/1024000*100)/100);
				document.getElementById(aDeviceID + "Meter").setAttribute("value", Math.round(aConsumption/aCapacity*100));
				document.getElementById(aDeviceID + "Entries").setAttribute("value", aEntryCount +" "+ self._bundle.getString("entries"));
			},
			
			onCacheEntryInfo: function (aURI,aIdEnhance,aDataSize,aFetchCount,aLastModifiedTime,aExpirationTime) {
				if (aURI.scheme.indexOf("http") == 0) {
					self._entries.push(new Array(
						aURI.prePath+aURI.path,
						aDataSize,
						"disk",
						aLastModifiedTime*1000000,
						aExpirationTime*1000000,
						aFetchCount
					));
					self._mapUri[aURI.prePath+aURI.path]=aURI;
				}
			},
			onCacheEntryVisitCompleted: function (){
				it = new Iterator(self._entries);
				timer.init(new item_timerCallback(), 0, timer.TYPE_ONE_SHOT);
			}
		}
		var memory_visitor = {
			onCacheStorageInfo: function (aEntryCount, aConsumption, aCapacity, aDiskDirectory) {
				var aDeviceID = "memory";
				document.getElementById(aDeviceID).setAttribute("value", Math.round(aConsumption/1024000*100)/100+"/"+Math.round(aCapacity/1024000*100)/100);
				document.getElementById(aDeviceID + "Meter").setAttribute("value", Math.round(aConsumption/aCapacity*100));
				document.getElementById(aDeviceID + "Entries").setAttribute("value", aEntryCount +" "+ self._bundle.getString("entries"));
			},
			onCacheEntryInfo: function (aURI,aIdEnhance,aDataSize,aFetchCount,aLastModifiedTime,aExpirationTime) {
				if (aURI.path.indexOf("http") == 0) {
					self._entries.push(new Array(
						aURI.prePath+aURI.path,
						aDataSize,
						"memory",
						aLastModifiedTime*1000000,
						aExpirationTime*1000000,
						aFetchCount
					));
					self._mapUri[aURI.prePath+aURI.path]=aURI;
				}
			},
			onCacheEntryVisitCompleted: function (){
				self._cacheService.diskCacheStorage(LoadContextInfo.default,false).asyncVisitStorage(disk_visitor,true);
			}
		}
		this._cacheService.memoryCacheStorage(LoadContextInfo.default,false).asyncVisitStorage(memory_visitor,true);
	},
	
	finish: function CV_finish() {
		this._DBConn.close();
		this._DBConn = null;
		
		this._root = null;
		this._rdf = null;
		this._bundle = null;
		this._tree = null;
	},
	
	openCache: function CV_openCache() {
		var resource = this._getResourceAtCurrentIndex();
		if (!resource) return;
		
		var key = this._rdf.getLiteralProperty(resource, this._rdf.NS_CACHEVIEWER+"key");
		
		this._getBrowser().selectedTab = this._getBrowser().addTab(key);
	},
	_delSelEntry: function CV__delSelEntry(){
		if (this._delEntryList.length == 0)
		{
			this._updateUI();
			return
		}
		var item = this._delEntryList.shift();
		var key = this._rdf.getLiteralProperty(item, this._rdf.NS_CACHEVIEWER+"key");
		var self = this;
		this._asyncOpenCacheEntry(key,{
			onCacheEntryCheck: function (entry, appcache) {
				return Ci.nsICacheEntryOpenCallback.ENTRY_WANTED;
			},
			onCacheEntryAvailable: function(entry, isnew, appcache, status){
				if(status != Components.results.NS_OK)
				{
					self._delSelEntry();
					return;
				}
				entry.asyncDoom({
					onCacheEntryDoomed:function(aResult){
						if(aResult == Components.results.NS_OK)
						{
							// moved from _updateUI
							self._rdf.removeResource(item, self._rdf.getContainer(self._rdf.RDF_ITEM_ROOT));
							if (self._tree.ref == self._rdf.RDF_ITEM_SEARCH)
								self._rdf.removeResource(item, self._rdf.getContainer(self._rdf.RDF_ITEM_SEARCH));
							self._DBConn.executeSimpleSQL("DELETE FROM cacheentries WHERE id = "+item.Value);
							self._delSelEntry();
						}
					}
				});
			}
		}
		);
	},
	deleteCache: function CV_deleteCache() {
		if (this._isLoading) return;
		
		this._delEntryList = [];
		var rangeCount = this._tree.view.selection.getRangeCount();
		for (var i=0; i<rangeCount; ++i) {
			var rangeMin = {};
			var rangeMax = {};
			this._tree.view.selection.getRangeAt(i, rangeMin, rangeMax);
			for (var j=rangeMin.value; j<=rangeMax.value; ++j) {
				this._delEntryList.push(this._tree.view.getResourceAtIndex(j));
			}
		}
		if (this._delEntryList.length>0)
			this._delSelEntry();
		
	},
	
	reloadCache: function CV_reloadCache() {
		if (this._isLoading) return;
		
		var image = document.getElementById("previewImage");
		image.src = "";
		document.getElementById("cacheInfo").value = "";
		
		this._tree.database.RemoveDataSource(this._rdf.datasource);
		this._tree.builder.rebuild();
		
		this._rdf = null;
		this.__cacheService = null;
		
		this.init();
	},
	selAll: function CV_selAll() {
		this._tree.view.selection.selectAll();
	},
	removeAll: function CV_removeAll() {
		var promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"]
                              .getService(Ci.nsIPromptService);
		if (promptService.confirm(window,"CacheViewer2","Do you really want to remove All?"))
		{
			try {
				this._cacheService.clear();
	        } catch(er) {}
			this.reloadCache();
		}
	},
	saveCache: function CV_saveCache(keepStruct) {
		var selection = [];
		var rangeCount = this._tree.view.selection.getRangeCount();
		if (typeof(keepStruct) == "undefine")
			keepStruct = false
		for (var i=0; i<rangeCount; ++i) {
			var rangeMin = {};
			var rangeMax = {};
			this._tree.view.selection.getRangeAt(i, rangeMin, rangeMax);
			for (var j=rangeMin.value; j<=rangeMax.value; ++j) {
				selection.push(this._tree.view.getResourceAtIndex(j));
			}
		}
		var pref = Cc["@mozilla.org/preferences-service;1"]
					.getService(Ci.nsIPrefService)
					.getBranch("extensions.cacheviewer2.");
		var lastFolderPath = pref.getComplexValue("folder", Ci.nsISupportsString).data;
		var lastFolder = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile)
		if (lastFolderPath)
			lastFolder.initWithPath(lastFolderPath);
		
		var fp = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
		
		if (selection.length > 1 || keepStruct) {
			fp.init(window, null, Ci.nsIFilePicker.modeGetFolder);
		} else {
			fp.init(window, null, Ci.nsIFilePicker.modeSave);
			fp.defaultString = this._guessFileName(this._rdf.getLiteralProperty(selection[0], this._rdf.NS_CACHEVIEWER+"key"), this._rdf.getLiteralProperty(selection[0], this._rdf.NS_CACHEVIEWER+"type"))
		}
		fp.displayDirectory = lastFolder;
		var res = fp.show();
		if (res == Ci.nsIFilePicker.returnCancel)
			return;
		var str = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
		if (selection.length > 1 || keepStruct) {
			str.data = fp.file.path;
		} else {
			str.data = fp.file.parent.path;
		}
		pref.setComplexValue("folder", Ci.nsISupportsString, str);
		
		var folder = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
		folder.initWithPath(fp.file.path);
		var totalsel = selection.length;
		for (i=0; i<selection.length; i++) {
			var key = this._rdf.getLiteralProperty(selection[i], this._rdf.NS_CACHEVIEWER+"key");
			var device = this._rdf.getLiteralProperty(selection[i], this._rdf.NS_CACHEVIEWER+"dev");
			var type = this._rdf.getLiteralProperty(selection[i], this._rdf.NS_CACHEVIEWER+"type");
			var self = this;
			var last = i+1 == totalsel;
			var listener = {
				_key: key,
				_device: device,
				_type: type,
				_last: last,
				onCacheEntryCheck: function (entry, appcache) {
					return Ci.nsICacheEntryOpenCallback.ENTRY_WANTED;
				},
				onCacheEntryAvailable: function(entry, isnew, appcache, status) {
					if(status != Components.results.NS_OK)
					{
						return;
					}
					var file = folder.clone();
					if(keepStruct)
					{
						var ds = this._key.substr(this._key.indexOf("://")+3).split("/")
						for (n in ds)
						{
							file.append(ds[n]);
							if (n != ds.length-1 && !file.exists())
								file.create(Ci.nsIFile.DIRECTORY_TYPE,0666)
						}
					}
					if (selection.length > 1 || keepStruct)
						file.append(self._guessFileName(this._key, this._type));
					if (res == Ci.nsIFilePicker.returnReplace) {
						if (!file.exists()) {
							file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);
						}
					} else
						file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);
					// If memory cache, use "internalSave".
					// (See chrome://global/content/contentAreaUtils.js)
					if (this._device == "memory") {
						var auto = new AutoChosen(file, makeURI(this._key));
						internalSave(this._key, null, null, null,
									 null, false, null,
									 auto, null, document);
						return;
					}
					
					// Check the encoding.
					var metaData = "";
					var encode = "";
					var visitor = {
						visitMetaDataElement: function(aKey, aValue) {
							metaData += aKey + ": " + aValue + "\n";
						}
					};
					entry.visitMetaData(visitor);
					if (metaData.match(/Content-Encoding: (.+)$/m)) {
						encode = RegExp.$1;
					}
					try {
						entry.setValid();
						var inputStream = entry.openInputStream(0);
						
						if (encode) {
							var converterService = Cc["@mozilla.org/streamConverters;1"]
											.getService(Ci.nsIStreamConverterService);
							var converter = converterService.asyncConvertData(encode, "uncompressed", new StreamListener(file), null);
							converter.onStartRequest(null, null);
							converter.onDataAvailable(null, null, inputStream, 0, inputStream.available());
							converter.onStopRequest(null, null, null);
							return;
						}
						var fileOutputStream = Cc["@mozilla.org/network/file-output-stream;1"]
													.createInstance(Ci.nsIFileOutputStream);
						var binaryInputStream = Cc["@mozilla.org/binaryinputstream;1"]
													.createInstance(Ci.nsIBinaryInputStream);
						let pump = Cc["@mozilla.org/network/input-stream-pump;1"].createInstance(Ci.nsIInputStreamPump);
						pump.init(inputStream, 0, -1, 0, 0, true);
						var vlast = this._last
						let data = []
						pump.asyncRead({
							onStartRequest: function(aRequest, aContext) {},
							onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {
								data.push(new BinaryInputStream(aInputStream).readBytes(aCount));
							},
							onStopRequest: function(aRequest, aContext, aStatusCode) {
								let content = data.join("");
								fileOutputStream.init(file, -1, 0755, 0);
								fileOutputStream.write(content, content.length);
								fileOutputStream.flush();
								fileOutputStream.close();
								if(vlast)
								{
									window.alert("OK!");
								}
							}
						}, null);
					} catch(e) {
						dump(e+"\n");
						file.remove(false);
					}
				}
			}
			this._asyncOpenCacheEntry(key, listener);
		}
	},

	// pXs added searchtype and searchsize since v0.9
	search: function CV_search(aSearchString) {
		var aSearchString = document.getElementById("search").value;
		aSearchString = aSearchString.replace(/^ +/, "");
		var aSearchSize = document.getElementById("searchsize").value;
		var aSearchType = document.getElementById("searchtype").value;
		
		if (aSearchString || aSearchSize || aSearchType) {
			this._rdf.datasource.beginUpdateBatch();
			this._rdf.removeResource(this._rdf.getResource(this._rdf.RDF_ITEM_SEARCH), null);
			
			if (aSearchSize && aSearchSize >= 0) {aSearchSize = aSearchSize;} else {aSearchSize = 0;}
			var statement = this._DBConn.createStatement("SELECT id FROM cacheentries WHERE key LIKE '%"+ aSearchString.replace(/ +/g, " ").replace(/ $/, "").split(" ").join("%' AND key LIKE '%") +"%' AND size >= "+ aSearchSize +" AND type LIKE '%"+ aSearchType +"%'");
			
			var searchContainer = this._rdf.getContainer(this._rdf.RDF_ITEM_SEARCH);
			while (statement.executeStep()) {
				searchContainer.AppendElement(this._rdf.getResource(statement.getInt32(0)));
			}
			this._rdf.datasource.endUpdateBatch();
			
			statement.reset();
			statement.finalize();
			statement = null;
			
			this._tree.ref = this._rdf.RDF_ITEM_SEARCH;
		} else {
			this._tree.ref = this._rdf.RDF_ITEM_ROOT;
		}
		this._updateCount();
		document.getElementById("showall").disabled = !aSearchString && !aSearchSize && !aSearchType;
	},
	_updateCount: function CV__updateCount(){
		document.getElementById("selectionCountLabel").value = this._tree.view.selection.count +"/"+ this._tree.view.rowCount;
	},
	showAll: function CV_showAll() {
		var textbox = document.getElementById("search");
		textbox.value = "";
		// pXs added searchtype and searchsize since v0.9
		document.getElementById("searchtype").value = "";
		document.getElementById("searchsize").value = "";
		textbox.focus();
		this.search("");
	},
	
	onSelect: function CV_onSelect() {
		if (this._tree.view.selection.count == 1) {
			var timer = Components.classes["@mozilla.org/timer;1"]
						.createInstance(Components.interfaces.nsITimer);
			var self = this;
			function timerCallback() {}
			timerCallback.prototype = {
				observe: function(aTimer, aTopic, aData) {
					self._makePreview(self._tree.view.selection.currentIndex);
				}
			}
			timer.init(new timerCallback(), 0, timer.TYPE_ONE_SHOT);
		}
		this._updateCount();
	},
	
	onPopupShowing: function CV_onPopupShowing() {
		var menu = document.getElementById("deleteCache");
		if (this._isLoading)
			menu.setAttribute("disabled", "true");
		else
			if (menu.hasAttribute("disabled"))
				menu.removeAttribute("disabled");
	},
	
	resize: function CV_resize(event) {
		var image = document.getElementById("previewImage");
		if (image.hasAttribute("style")) {
			image.removeAttribute("style");
			return;
		}
		
		var width = parseInt(window.getComputedStyle(image, "").width.replace("px", ""));
		var height = parseInt(window.getComputedStyle(image, "").height.replace("px", ""));
		
		var containerWidth = parseInt(window.getComputedStyle(image.parentNode.parentNode, "").width.replace("px", ""));
		var containerHeight = parseInt(window.getComputedStyle(image.parentNode.parentNode, "").height.replace("px", ""));
		
		if (width > containerWidth) {
			var zoomX = containerWidth / width;
			width = containerWidth - 2;
			height = height * zoomX - 2;
		}
		if (height > containerHeight) {
			var zoomY = containerHeight / height;
			height = containerHeight - 2;
			width = width * zoomY - 2;
		}
		image.setAttribute("style", "width:"+width+"px;"+"height:"+height+"px;");
	},
	
	// ***** nsICacheEntryMetaDataVisitor *****
	onMetaDataElement: function CV_visitMetaDataElement(aKey, aValue) {
		this._metaData += aKey + ": " + aValue + "\n";
	},
	
	// ***** Helper functions *****
	_makePreview: function CV__makePreview(aRow) {
		var resource = this._tree.view.getResourceAtIndex(aRow);
		var key = this._rdf.getLiteralProperty(resource, this._rdf.NS_CACHEVIEWER+"key");
		var type =  this._rdf.getLiteralProperty(resource, this._rdf.NS_CACHEVIEWER+"type");
		var self = this;
		var listener = {
			onCacheEntryCheck: function (entry, appcache) {
				return Ci.nsICacheEntryOpenCallback.ENTRY_WANTED;
			},
			onCacheEntryAvailable: function(entry, isnew, applicationCache, status) {
				if(status != Components.results.NS_OK)
				{
					document.getElementById("cacheInfo").value = "open fail!";
					return;
				}
				entry.setValid();
				var value = self._bundle.getString("key")        + " " + entry.key + "\n" +
							self._bundle.getString("size")       + " " + entry.dataSize + " " + self._bundle.getString("bytes") + "\n" +
							self._bundle.getString("count")      + " " + entry.fetchCount + "\n" +
							self._bundle.getString("modified")   + " " + self._formatDate(entry.lastModified*1000) + "\n" +
							self._bundle.getString("fetched")    + " " + self._formatDate(entry.lastFetched*1000) + "\n" + 
							self._bundle.getString("expiration") + " ";
				if (parseInt(0xFFFFFFFF) <= entry.expirationTime)
					value += self._bundle.getString("noexpiration") + "\n";
				else
					value += self._formatDate(entry.expirationTime*1000) + "\n";
				value += self._bundle.getString("fileondisk") + " ";
				var cacheFile;
				try { cacheFile = entry.file; } catch(e) { cacheFile = null; }
				if (cacheFile)
					value += cacheFile.path + "\n\n";
				else
					value += self._bundle.getString("nofile") + "\n\n";
				entry.metaDataReady();
				self._metaData = "";
				entry.visitMetaData(self);
				value += self._metaData;
				var url = "chrome://cacheviewer/content/not_image.png";
				document.getElementById("cacheInfo").value = value;
				if (type && (type.indexOf("image") == 0) ||
					(key.match(/.*(\.png|\.gif|\.jpg|\.ico|\.bmp)$/i))) {
						url = "about:cacheviewer2?"+key;
				}
				var image = document.getElementById("previewImage");
				image.src = url;
				if (image.hasAttribute("style"))
					image.removeAttribute("style");
				image.onload = function() {
					self.resize();
				}
			}
		}
		this._asyncOpenCacheEntry(key,listener);
	},
	
	_getResourceAtCurrentIndex: function CV__getResourceAtCurrentIndex() {
		if (!this._tree.view.selection || this._tree.view.selection.count != 1)
			return null;
			
		return this._tree.view.getResourceAtIndex(this._tree.view.selection.currentIndex);
	},
	
	_guessFileName: function CV__geussFileName(aKey, aMimeType) {
		var URIFix = Cc["@mozilla.org/docshell/urifixup;1"].getService(Ci.nsIURIFixup);
		var URI = URIFix.createFixupURI(aKey, 0);
		var fileInfo = new FileInfo();
		initFileInfo(fileInfo, URI.spec, null, null, null, null);
		var ext = fileInfo.fileExt;
		if ((aMimeType != "text/html") && (ext.indexOf("htm") >= 0)) {
			if (aMimeType == "image/jpeg")
				ext = "jpg";
			else if (aMimeType == "image/gif")
				ext = "gif";
			else if (aMimeType == "image/png")
				ext = "png";
			else if (aMimeType == "image/x-icon")
				ext = "ico";
			else if ((aMimeType.indexOf("javascript") >= 0) ||
				(aMimeType == "application/json"))
				ext = "js";
			else if (aMimeType.indexOf("/xml") >= 0)
				ext = "xml";
			else if (aMimeType == "application/x-shockwave-flash")
				ext = "swf";
			else if (aMimeType == "text/css")
				ext = "css";
			else if (aMimeType == "video/flv")
				ext = "flv";
		}
		return fileInfo.fileBaseName+"."+ext;
	},
	
	_getBrowser: function CV__getBrowser() {
		return this._getTopWin().document.getElementById("content");
	},
	
	_getTopWin: function CV__getTopWin() {
		var windowManager = Cc["@mozilla.org/appshell/window-mediator;1"].getService();
		var windowManagerInterface = windowManager.QueryInterface(Ci.nsIWindowMediator);
		return windowManagerInterface.getMostRecentWindow("navigator:browser");
	},
	
	_updateUI: function CV_updateUI() {
		var currentIndex = this._tree.view.selection.currentIndex;
		//var resource = this._getResourceAtCurrentIndex();
		
		var rowCount = this._tree.view.rowCount;
		if (currentIndex == rowCount)
			currentIndex--;
		if (rowCount > 0)
			this._tree.view.selection.select(currentIndex);
		else
			document.getElementById("cacheInfo").value = "";
	},
	
	_toggleButton: function CV__toggleButton(aIsLoading) {
		var reload = document.getElementById("reload");
		if (aIsLoading) {
			if (reload.hasAttribute("enable"))
				reload.removeAttribute("enable");
		} else {
			reload.setAttribute("enable", "true");
		}
	},
	
	_formatDate: function CV__formatDate(aTime) {
		var date = new Date(aTime);
		return this._dateService.FormatDateTime("",
					this._dateService.dateFormatLong,
					this._dateService.timeFormatSeconds,
					date.getFullYear(),
					date.getMonth()+1,
					date.getDate(),
					date.getHours(),
					date.getMinutes(),
					date.getSeconds());
	},
	
	_asyncOpenCacheEntry: function CV__asyncOpenCacheEntry(aKey,cICacheListener) {
		var storage = this._cacheService.diskCacheStorage(LoadContextInfo.default,false);
		storage.asyncOpenURI(
			this._mapUri[aKey],
			"",
			Ci.nsICacheStorage.OPEN_READONLY,
			cICacheListener)
	}
};

// ***** StreamListener for Asynchronous Converter *****
function StreamListener(aFile) {
	this._file = aFile;
	this._data = null;
}

StreamListener.prototype = {
	
	onStartRequest: function(aRequest, aContext) {},
	
	onStopRequest: function(aRequest, aContext, aStatusCode) {
		var fileOutputStream = Cc["@mozilla.org/network/file-output-stream;1"]
											.createInstance(Ci.nsIFileOutputStream);
		try {
			fileOutputStream.init(this._file, -1, 0666, 0);
			fileOutputStream.write(this._data, this._data.length);
			fileOutputStream.flush();
		} catch(e) {
			dump(e+"\n");
			this._file.remove(false);
		} finally {
			fileOutputStream.close();
		}
	},
	
	onDataAvailable: function(aRequest, aContext, aInputStream, aOffset, aCount) {
		var binaryInputStream = Cc["@mozilla.org/binaryinputstream;1"]
											.createInstance(Ci.nsIBinaryInputStream);
		binaryInputStream.setInputStream(aInputStream);
		this._data += binaryInputStream.readBytes(binaryInputStream.available());
		binaryInputStream.close();
	}
};

const BinaryInputStream = Components.Constructor("@mozilla.org/binaryinputstream;1", "nsIBinaryInputStream", "setInputStream");