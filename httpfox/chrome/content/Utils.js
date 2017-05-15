/*
	HttpFox - An HTTP analyzer addon for Firefox
	Copyright (C) 2008 Martin Theimer
	
	This program is free software; you can redistribute it and/or modify
	it under the terms of the GNU General Public License as published by
	the Free Software Foundation; either version 2 of the License, or
	(at your option) any later version.
	
	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
	GNU General Public License for more details.
	
	You should have received a copy of the GNU General Public License
	along with this program; if not, write to the Free Software
	Foundation, Inc., 675 Mass Ave, Cambridge, MA 02139, USA.
*/

if(!net) var net={};
if(!net.decoded) net.decoded={};
if(!net.decoded.utils) net.decoded.utils={};

net.decoded.utils = {

	// Date and Time stuff
	formatTimeDifference: function(startTime, endTime)
	{
		if (startTime === null || endTime === null)
		{
			return "*";
		}
		
		// values ok
		var diff = endTime - startTime;
		
		var string = "";
		string += diff / 1000;
		var dummy = string.split(".");
		while (dummy[1].length < 3) dummy[1] += "0";
		var after = (dummy[1]) ? dummy[1] : "000";
		return dummy[0] + "." + after;
	},
	
	dateFromUnixTimestamp: function(timestamp)
	{
		return new Date(timestamp * 1000);
	},
	
	formatDateTime: function(myDate)
	{
		if (myDate instanceof Date) 
		{
			return myDate.toLocaleString();	
		}
		else 
		{
			return this.formatDateTime(this.dateFromUnixTimestamp(myDate));
		}
	},
	
	formatTime: function(time)
	{
		var h = (time - (time % 3600000)) / 3600000;
		time = time - (h * 3600000);
	
		var m = (time - (time % 60000)) / 60000;
		time = time - (m * 60000);
	
		var s = (time - (time % 1000)) / 1000;
		time = time - (s * 1000);
	
		var ms = time;
		
		var string = "";
		
		string += this.lZero(h);
		string += ":" + this.lZero(m);
		string += ":" + this.lZero(s);
		string += "." + this.pad(ms, 3);
		
		return string;
	},
	
	lZero: function(x) 
	{	
		// after Dietmar Meier
		return (-x > -10 && x >= 0 && "0" || "") + x;
	},
	
	pad: function(val, len)
	{
		val = String(val);
		len = len || 2;
		while (val.length < len) val = "0" + val;
		return val;
	},
	
	// size functions
	humanizeSize: function(size, displayUntil)
	{
		var hsize = size;
		var hchar = "";
		var dotPos = -1;
		if (displayUntil == "undefined") 
		{
			displayUntil = 3;
		}
		
		if (size > 1073741824 && displayUntil <= 9)
		{
			hsize = size / 1073741824;
			hchar = "G";
		}
		
		if (size > 1048576 && displayUntil <= 6)
		{
			hsize = size / 1048576;
			hchar = "M";
		}
		
		if (size > 1024 && displayUntil <= 3)
		{
			hsize = size / 1024;
			hchar = "k";
		}
		
		hsize = hsize.toString();
		
		if ((dotPos = hsize.indexOf(".")) != -1)
		{
			hsize = hsize.substring(0, dotPos + 2);
		}
		
		return hsize + hchar;
	},
	
	// Utility function, dump an object by reflexion up to niv level
	dumpall: function(name, obj, niv) 
	{
		if (!niv) {
			niv=1;
		}
		var dumpdict = {};
	
		dump ("\n\n-------------------------------------------------------\n");
		dump ("Dump of the object: " + name + " (" + niv + " levels)\n");
		dump ("Address: " + obj + "\n");
		dump ("Interfaces: ");
		
		for (var i in Components.interfaces) 
		{
			if (Components.interfaces.hasOwnProperty(i)) {
				try 
				{
					obj.QueryInterface(Components.interfaces[i]);
					dump("" + Components.interfaces[i] + ", ");
				} 
				catch(ex) 
				{}	
			}
		}
		dump("\n");
		this._dumpall(dumpdict,obj,niv,"","");
		dump ("\n\n-------------------------------------------------------\n\n");
	
		for (i in dumpdict) 
		{
			if (dumpdict.hasOwnProperty(i)) {
				delete dumpdict[i];	
			}
		}
	},
	
	_dumpall: function(dumpdict, obj, niv, tab, path) 
	{
		if (obj in dumpdict) 
		{
			dump(" (Already dumped)");
		} 
		else 
		{
			dumpdict[obj]=1;
			
			var i, r, str, typ;
			for (i in obj) 
			{
				if (obj.hasOwnProperty(i)) {
					try 
					{
						str = String(obj[i]).replace(/\n/g, "\n" + tab);
					} 
					catch(ex) 
					{
						str = String(ex);
					}
					try 
					{
						typ = "" + typeof(obj[i]);
					} 
					catch(ex) 
					{
						typ = "unknown";
					}
					dump ("\n" + tab + i + " (" + typ + (path ? ", " + path : "") + "): " + str);
					if ((niv > 1) && (typ == "object")) 
					{
						this._dumpall(dumpdict, obj[i], niv-1, tab + "\t", (path ? path + "->" + i : i));
					}	
				}
			}
		}
	},
	// ************************************************************************************************
	
	stripNewlines: function(text)
	{
		return text.replace(/(\r\n|\r|\n)/, "");
	},
	
	isXml: function(text)
	{
		if (text.match(/<\?xml[^\?>]*\?>/i))
		{
			// xml header found
			return true;
		}
		
		return this.stripNewlines(text).match(/<([^> ]+)( [^>]+)*>.*<\/\1>|<[^>]+\/>/i);
	},
	
	isContentTypeXml: function(typestring)
	{
		if (typestring.indexOf("xml") != -1) 
		{
			return true;
		}
		
		if (typestring.indexOf("rdf") != -1) 
		{
			return true;
		}
		
		if (typestring.indexOf("dtd") != -1) 
		{
			return true;
		}
		
		return false;
	},
	
	// from live http headers:
	// Utility function to save data to clipboard
	toClipboard: function(data)
	{
		if (data) 
		{
			// clipboard helper
			try
			{
				const clipboardHelper = Components.classes["@mozilla.org/widget/clipboardhelper;1"].getService(Components.interfaces.nsIClipboardHelper);
				clipboardHelper.copyString(data);
			} 
			catch(ex) 
			{
				// do nothing, later code will handle the error
				dump("Unable to get the clipboard helper\n");
			}
		}
	},
	
	// Utility function to save data to a file
	/*saveAs: function(data, title)
	{
		if (!title) title = "LiveHTTPHeaders";
		const MODE =  0x2A; // MODE_WRONLY | MODE_CREATE | MODE_TRUNCAT
		const PERM = 00644; // PERM_IRUSR | PERM_IWUSR | PERM_IRGRP | PERM_IROTH
		const PICKER_CTRID = "@mozilla.org/filepicker;1";
		const FILEOUT_CTRID = "@mozilla.org/network/file-output-stream;1";
		const nsIFilePicker = Components.interfaces.nsIFilePicker;
		const nsIFileOutputStream = Components.interfaces.nsIFileOutputStream;
	
		try 
		{
			var picker = Components.classes[PICKER_CTRID].createInstance(nsIFilePicker);
			picker.appendFilters(Components.interfaces.nsIFilePicker.filterAll);
			picker.init (window, title, Components.interfaces.nsIFilePicker.modeSave);
			var rv = picker.show();
	
			if (rv != Components.interfaces.nsIFilePicker.returnCancel) 
			{
				var os = Components.classes[FILEOUT_CTRID].createInstance(nsIFileOutputStream);
				os.init(picker.file, MODE, PERM, 0);
				os.write(data, data.length);
			}
		} 
		catch(ex)
		{
			alert(ex);
		}
	},*/
	// ************************************************************************************************
	
	openWindow: function(windowType, url, features, params)
	{
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
	
		var win = windowType ? wm.getMostRecentWindow(windowType) : null;
		if (win) 
		{
			if ("initWithParams" in win)
			{
				win.initWithParams(aParams);
			}
			win.focus();
		}
		else 
		{
			var winFeatures = "resizable,dialog=no,centerscreen" + (features !== "" ? ("," + features) : "");
			var parentWindow = (!window.opener || window.opener.closed) ? window : window.opener;
			win = parentWindow.openDialog(url, "_blank", winFeatures, params);
		}
		return win;
	},
	
	urlDecode: function(value)
	{
		var decoded = value.replace(/\+/g, " ");
		decoded = unescape(decoded);
		
		return decoded;
	},
	
	nsResultErrors:
	{
		"c1f30000": "NS_ERROR_BASE",
		"80004001": "NS_ERROR_NOT_IMPLEMENTED",
		"80004003": "NS_ERROR_INVALID_POINTER",
		"80004004": "NS_ERROR_ABORT",
		"80004005": "NS_ERROR_FAILURE",
		"8000ffff": "NS_ERROR_UNEXPECTED",
		"80010010": "NS_ERROR_PROXY_INVALID_IN_PARAMETER",
		"80010011": "NS_ERROR_PROXY_INVALID_OUT_PARAMETER",
		"80040110": "NS_ERROR_NO_AGGREGATION",
		"80040111": "NS_ERROR_NOT_AVAILABLE",
		"80040154": "NS_ERROR_FACTORY_NOT_REGISTERED",
		"80040155": "NS_ERROR_FACTORY_REGISTER_AGAIN",
		"800401f8": "NS_ERROR_FACTORY_NOT_LOADED",
		"8007000e": "NS_ERROR_OUT_OF_MEMORY",
		"80070057": "NS_ERROR_ILLEGAL_VALUE",
		"80460001": "NS_ERROR_CANNOT_CONVERT_DATA",
		"80460002": "NS_ERROR_OBJECT_IS_IMMUTABLE",
		"80460003": "NS_ERROR_LOSS_OF_SIGNIFICANT_DATA",
		"80460016": "NS_ERROR_SERVICE_NOT_AVAILABLE",
		"80460018": "NS_ERROR_IS_DIR",
		"8046001e": "NS_ERROR_ILLEGAL_DURING_SHUTDOWN",
		"80470002": "NS_BASE_STREAM_CLOSED",
		"80470003": "NS_BASE_STREAM_OSERROR",
		"80470004": "NS_BASE_STREAM_ILLEGAL_ARGS",
		"80470005": "NS_BASE_STREAM_NO_CONVERTER",
		"80470006": "NS_BASE_STREAM_BAD_CONVERSION",
		"80470007": "NS_BASE_STREAM_WOULD_BLOCK",
		"80480002": "NS_ERROR_GFX_PRINTER_CMD_NOT_FOUND",
		"80480003": "NS_ERROR_GFX_PRINTER_CMD_FAILURE",
		"80480004": "NS_ERROR_GFX_PRINTER_NO_PRINTER_AVAILABLE",
		"80480005": "NS_ERROR_GFX_PRINTER_NAME_NOT_FOUND",
		"80480006": "NS_ERROR_GFX_PRINTER_ACCESS_DENIED",
		"80480007": "NS_ERROR_GFX_PRINTER_INVALID_ATTRIBUTE",
		"80480009": "NS_ERROR_GFX_PRINTER_PRINTER_NOT_READY",
		"8048000a": "NS_ERROR_GFX_PRINTER_OUT_OF_PAPER",
		"8048000b": "NS_ERROR_GFX_PRINTER_PRINTER_IO_ERROR",
		"8048000c": "NS_ERROR_GFX_PRINTER_COULD_NOT_OPEN_FILE",
		"8048000d": "NS_ERROR_GFX_PRINTER_FILE_IO_ERROR",
		"8048000e": "NS_ERROR_GFX_PRINTER_PRINTPREVIEW",
		"8048000f": "NS_ERROR_GFX_PRINTER_STARTDOC",
		"80480010": "NS_ERROR_GFX_PRINTER_ENDDOC",
		"80480011": "NS_ERROR_GFX_PRINTER_STARTPAGE",
		"80480012": "NS_ERROR_GFX_PRINTER_ENDPAGE",
		"80480013": "NS_ERROR_GFX_PRINTER_PRINT_WHILE_PREVIEW",
		"80480014": "NS_ERROR_GFX_PRINTER_PAPER_SIZE_NOT_SUPPORTED",
		"80480015": "NS_ERROR_GFX_PRINTER_ORIENTATION_NOT_SUPPORTED",
		"80480016": "NS_ERROR_GFX_PRINTER_COLORSPACE_NOT_SUPPORTED",
		"80480017": "NS_ERROR_GFX_PRINTER_TOO_MANY_COPIES",
		"80480018": "NS_ERROR_GFX_PRINTER_DRIVER_CONFIGURATION_ERROR",
		"80480019": "NS_ERROR_GFX_PRINTER_DOC_IS_BUSY_PP",
		"8048001a": "NS_ERROR_GFX_PRINTER_DOC_WAS_DESTORYED",
		"8048001b": "NS_ERROR_GFX_PRINTER_NO_XUL",
		"8048001c": "NS_ERROR_GFX_NO_PRINTDIALOG_IN_TOOLKIT",
		"8048001d": "NS_ERROR_GFX_NO_PRINTROMPTSERVICE",
		"8048001e": "NS_ERROR_GFX_PRINTER_PLEX_NOT_SUPPORTED",
		"8048001f": "NS_ERROR_GFX_PRINTER_DOC_IS_BUSY",
		"80480020": "NS_ERROR_GFX_PRINTING_NOT_IMPLEMENTED",
		"80480021": "NS_ERROR_GFX_COULD_NOT_LOAD_PRINT_MODULE",
		"80480022": "NS_ERROR_GFX_PRINTER_RESOLUTION_NOT_SUPPORTED",
		"804b0001": "NS_BINDING_FAILED",
		"804b0002": "NS_BINDING_ABORTED",
		"804b0003": "NS_BINDING_REDIRECTED",
		"804b0004": "NS_BINDING_RETARGETED",
		"804b000a": "NS_ERROR_MALFORMED_URI",
		"804b000b": "NS_ERROR_ALREADY_CONNECTED",
		"804b000c": "NS_ERROR_NOT_CONNECTED",
		"804b000d": "NS_ERROR_CONNECTION_REFUSED",
		"804b000e": "NS_ERROR_NET_TIMEOUT",
		"804b000f": "NS_ERROR_IN_PROGRESS",
		"804b0010": "NS_ERROR_OFFLINE",
		"804b0011": "NS_ERROR_NO_CONTENT",
		"804b0012": "NS_ERROR_UNKNOWN_PROTOCOL",
		"804b0013": "NS_ERROR_PORT_ACCESS_NOT_ALLOWED",
		"804b0014": "NS_ERROR_NET_RESET",
		"804b0015": "NS_ERROR_FTP_LOGIN",
		"804b0016": "NS_ERROR_FTP_CWD",
		"804b0017": "NS_ERROR_FTP_PASV",
		"804b0018": "NS_ERROR_FTP_PWD",
		"804b0019": "NS_ERROR_NOT_RESUMABLE",
		"804b001b": "NS_ERROR_INVALID_CONTENT_ENCODING",
		"804b001c": "NS_ERROR_FTP_LIST",
		"804b001e": "NS_ERROR_UNKNOWN_HOST",
		"804b001f": "NS_ERROR_REDIRECT_LOOP",
		"804b0020": "NS_ERROR_ENTITY_CHANGED",
		"804b002a": "NS_ERROR_UNKNOWN_PROXY_HOST",
		"804b0033": "NS_ERROR_UNKNOWN_SOCKET_TYPE",
		"804b0034": "NS_ERROR_SOCKET_CREATE_FAILED",
		"804b003d": "NS_ERROR_CACHE_KEY_NOT_FOUND",
		"804b003e": "NS_ERROR_CACHE_DATA_IS_STREAM",
		"804b003f": "NS_ERROR_CACHE_DATA_IS_NOT_STREAM",
		"804b0040": "NS_ERROR_CACHE_WAIT_FOR_VALIDATION",
		"804b0041": "NS_ERROR_CACHE_ENTRY_DOOMED",
		"804b0042": "NS_ERROR_CACHE_READ_ACCESS_DENIED",
		"804b0043": "NS_ERROR_CACHE_WRITE_ACCESS_DENIED",
		"804b0044": "NS_ERROR_CACHE_IN_USE",
		"804b0046": "NS_ERROR_DOCUMENT_NOT_CACHED",
		"804b0047": "NS_ERROR_NET_INTERRUPT",
		"804b0048": "NS_ERROR_PROXY_CONNECTION_REFUSED",
		"804b0049": "NS_ERROR_ALREADY_OPENED",
		"804b004a": "NS_ERROR_UNSAFE_CONTENT_TYPE",
		"804b0050": "NS_ERROR_INSUFFICIENT_DOMAIN_LEVELS",
		"804b0051": "NS_ERROR_HOST_IS_IP_ADDRESS",
		"804c03e8": "NS_ERROR_PLUGINS_PLUGINSNOTCHANGED",
		"804c03e9": "NS_ERROR_PLUGIN_DISABLED",
		"804c03ea": "NS_ERROR_PLUGIN_BLOCKLISTED",
		"804e03e8": "NS_ERROR_HTMLPARSER_EOF",
		"804e03e9": "NS_ERROR_HTMLPARSER_UNKNOWN",
		"804e03ea": "NS_ERROR_HTMLPARSER_CANTPROPAGATE",
		"804e03eb": "NS_ERROR_HTMLPARSER_CONTEXTMISMATCH",
		"804e03ec": "NS_ERROR_HTMLPARSER_BADFILENAME",
		"804e03ed": "NS_ERROR_HTMLPARSER_BADURL",
		"804e03ee": "NS_ERROR_HTMLPARSER_INVALIDPARSERCONTEXT",
		"804e03ef": "NS_ERROR_HTMLPARSER_INTERRUPTED",
		"804e03f0": "NS_ERROR_HTMLPARSER_BLOCK",
		"804e03f1": "NS_ERROR_HTMLPARSER_BADTOKENIZER",
		"804e03f2": "NS_ERROR_HTMLPARSER_BADATTRIBUTE",
		"804e03f3": "NS_ERROR_HTMLPARSER_UNRESOLVEDDTD",
		"804e03f4": "NS_ERROR_HTMLPARSER_MISPLACEDTABLECONTENT",
		"804e03f5": "NS_ERROR_HTMLPARSER_BADDTD",
		"804e03f6": "NS_ERROR_HTMLPARSER_BADCONTEXT",
		"804e03f7": "NS_ERROR_HTMLPARSER_STOPPARSING",
		"804e03f8": "NS_ERROR_HTMLPARSER_UNTERMINATEDSTRINGLITERAL",
		"804e03f9": "NS_ERROR_HTMLPARSER_HIERARCHYTOODEEP",
		"804e03fa": "NS_ERROR_HTMLPARSER_FAKE_ENDTAG",
		"804e03fb": "NS_ERROR_HTMLPARSER_INVALID_COMMENT",
		"80500001": "NS_ERROR_UCONV_NOCONV",
		"8050000e": "NS_ERROR_ILLEGAL_INPUT",
		"80510001": "NS_ERROR_REG_BADTYPE",
		"80510003": "NS_ERROR_REG_NOT_FOUND",
		"80510004": "NS_ERROR_REG_NOFILE",
		"80510005": "NS_ERROR_REG_BUFFER_TOO_SMALL",
		"80510006": "NS_ERROR_REG_NAME_TOO_LONG",
		"80510007": "NS_ERROR_REG_NO_PATH",
		"80510008": "NS_ERROR_REG_READ_ONLY",
		"80510009": "NS_ERROR_REG_BAD_UTF8",
		"80520001": "NS_ERROR_FILE_UNRECOGNIZED_PATH",
		"80520002": "NS_ERROR_FILE_UNRESOLVABLE_SYMLINK",
		"80520003": "NS_ERROR_FILE_EXECUTION_FAILED",
		"80520004": "NS_ERROR_FILE_UNKNOWN_TYPE",
		"80520005": "NS_ERROR_FILE_DESTINATION_NOT_DIR",
		"80520006": "NS_ERROR_FILE_TARGET_DOES_NOT_EXIST",
		"80520007": "NS_ERROR_FILE_COPY_OR_MOVE_FAILED",
		"80520008": "NS_ERROR_FILE_ALREADY_EXISTS",
		"80520009": "NS_ERROR_FILE_INVALID_PATH",
		"8052000a": "NS_ERROR_FILE_DISK_FULL",
		"8052000b": "NS_ERROR_FILE_CORRUPTED",
		"8052000c": "NS_ERROR_FILE_NOT_DIRECTORY",
		"8052000d": "NS_ERROR_FILE_IS_DIRECTORY",
		"8052000e": "NS_ERROR_FILE_IS_LOCKED",
		"8052000f": "NS_ERROR_FILE_TOO_BIG",
		"80520010": "NS_ERROR_FILE_NO_DEVICE_SPACE",
		"80520011": "NS_ERROR_FILE_NAME_TOO_LONG",
		"80520012": "NS_ERROR_FILE_NOT_FOUND",
		"80520013": "NS_ERROR_FILE_READ_ONLY",
		"80520014": "NS_ERROR_FILE_DIR_NOT_EMPTY",
		"80520015": "NS_ERROR_FILE_ACCESS_DENIED",
		"80530001": "NS_ERROR_DOM_INDEX_SIZE_ERR",
		"80530002": "NS_ERROR_DOM_DOMSTRING_SIZE_ERR",
		"80530003": "NS_ERROR_DOM_HIERARCHY_REQUEST_ERR",
		"80530004": "NS_ERROR_DOM_WRONG_DOCUMENT_ERR",
		"80530005": "NS_ERROR_DOM_INVALID_CHARACTER_ERR",
		"80530006": "NS_ERROR_DOM_NO_DATA_ALLOWED_ERR",
		"80530007": "NS_ERROR_DOM_NO_MODIFICATION_ALLOWED_ERR",
		"80530008": "NS_ERROR_DOM_NOT_FOUND_ERR",
		"80530009": "NS_ERROR_DOM_NOT_SUPPORTED_ERR",
		"8053000a": "NS_ERROR_DOM_INUSE_ATTRIBUTE_ERR",
		"8053000b": "NS_ERROR_DOM_INVALID_STATE_ERR",
		"8053000c": "NS_ERROR_DOM_SYNTAX_ERR",
		"8053000d": "NS_ERROR_DOM_INVALID_MODIFICATION_ERR",
		"8053000e": "NS_ERROR_DOM_NAMESPACE_ERR",
		"8053000f": "NS_ERROR_DOM_INVALID_ACCESS_ERR",
		"80530010": "NS_ERROR_DOM_VALIDATION_ERR",
		"80530011": "NS_ERROR_DOM_TYPE_MISMATCH_ERR",
		"805303e8": "NS_ERROR_DOM_SECURITY_ERR",
		"805303e9": "NS_ERROR_DOM_SECMAN_ERR",
		"805303ea": "NS_ERROR_DOM_WRONG_TYPE_ERR",
		"805303eb": "NS_ERROR_DOM_NOT_OBJECT_ERR",
		"805303ec": "NS_ERROR_DOM_NOT_XPC_OBJECT_ERR",
		"805303ed": "NS_ERROR_DOM_NOT_NUMBER_ERR",
		"805303ee": "NS_ERROR_DOM_NOT_BOOLEAN_ERR",
		"805303ef": "NS_ERROR_DOM_NOT_FUNCTION_ERR",
		"805303f0": "NS_ERROR_DOM_TOO_FEW_PARAMETERS_ERR",
		"805303f1": "NS_ERROR_DOM_BAD_DOCUMENT_DOMAIN",
		"805303f2": "NS_ERROR_DOM_PROP_ACCESS_DENIED",
		"805303f3": "NS_ERROR_DOM_XPCONNECT_ACCESS_DENIED",
		"805303f4": "NS_ERROR_DOM_BAD_URI",
		"805303f5": "NS_ERROR_DOM_RETVAL_UNDEFINED",
		"805303f6": "NS_ERROR_DOM_QUOTA_REACHED",
		"80540005": "NS_IMAGELIB_ERROR_FAILURE",
		"80540006": "NS_IMAGELIB_ERROR_NO_DECODER",
		"80540007": "NS_IMAGELIB_ERROR_NOT_FINISHED",
		"80540008": "NS_IMAGELIB_ERROR_LOAD_ABORTED",
		"80540009": "NS_IMAGELIB_ERROR_NO_ENCODER",
		"80560001": "NS_ERROR_EDITOR_NO_SELECTION",
		"80560002": "NS_ERROR_EDITOR_NO_TEXTNODE",
		"80560003": "NS_FOUND_TARGET",
		"805800c8": "NS_ERROR_LAUNCHED_CHILD_PROCESS",
		"80590001": "NS_ERROR_LDAP_OPERATIONS_ERROR",
		"80590002": "NS_ERROR_LDAP_PROTOCOL_ERROR",
		"80590003": "NS_ERROR_LDAP_TIMELIMIT_EXCEEDED",
		"80590004": "NS_ERROR_LDAP_SIZELIMIT_EXCEEDED",
		"80590005": "NS_ERROR_LDAP_COMPARE_FALSE",
		"80590006": "NS_ERROR_LDAP_COMPARE_TRUE",
		"80590007": "NS_ERROR_LDAP_STRONG_AUTH_NOT_SUPPORTED",
		"80590008": "NS_ERROR_LDAP_STRONG_AUTH_REQUIRED",
		"80590009": "NS_ERROR_LDAP_PARTIAL_RESULTS",
		"8059000a": "NS_ERROR_LDAP_REFERRAL",
		"8059000b": "NS_ERROR_LDAP_ADMINLIMIT_EXCEEDED",
		"8059000c": "NS_ERROR_LDAP_UNAVAILABLE_CRITICAL_EXTENSION",
		"8059000d": "NS_ERROR_LDAP_CONFIDENTIALITY_REQUIRED",
		"8059000e": "NS_ERROR_LDAP_SASL_BIND_IN_PROGRESS",
		"80590010": "NS_ERROR_LDAP_NO_SUCH_ATTRIBUTE",
		"80590011": "NS_ERROR_LDAP_UNDEFINED_TYPE",
		"80590012": "NS_ERROR_LDAP_INAPPROPRIATE_MATCHING",
		"80590013": "NS_ERROR_LDAP_CONSTRAINT_VIOLATION",
		"80590014": "NS_ERROR_LDAP_TYPE_OR_VALUE_EXISTS",
		"80590015": "NS_ERROR_LDAP_INVALID_SYNTAX",
		"80590020": "NS_ERROR_LDAP_NO_SUCH_OBJECT",
		"80590021": "NS_ERROR_LDAP_ALIAS_PROBLEM",
		"80590022": "NS_ERROR_LDAP_INVALID_DN_SYNTAX",
		"80590023": "NS_ERROR_LDAP_IS_LEAF",
		"80590024": "NS_ERROR_LDAP_ALIAS_DEREF_PROBLEM",
		"80590030": "NS_ERROR_LDAP_INAPPROPRIATE_AUTH",
		"80590031": "NS_ERROR_LDAP_INVALID_CREDENTIALS",
		"80590032": "NS_ERROR_LDAP_INSUFFICIENT_ACCESS",
		"80590033": "NS_ERROR_LDAP_BUSY",
		"80590034": "NS_ERROR_LDAP_UNAVAILABLE",
		"80590035": "NS_ERROR_LDAP_UNWILLING_TO_PERFORM",
		"80590036": "NS_ERROR_LDAP_LOOP_DETECT",
		"8059003c": "NS_ERROR_LDAP_SORT_CONTROL_MISSING",
		"8059003d": "NS_ERROR_LDAP_INDEX_RANGE_ERROR",
		"80590040": "NS_ERROR_LDAP_NAMING_VIOLATION",
		"80590041": "NS_ERROR_LDAP_OBJECT_CLASS_VIOLATION",
		"80590042": "NS_ERROR_LDAP_NOT_ALLOWED_ON_NONLEAF",
		"80590043": "NS_ERROR_LDAP_NOT_ALLOWED_ON_RDN",
		"80590044": "NS_ERROR_LDAP_ALREADY_EXISTS",
		"80590045": "NS_ERROR_LDAP_NO_OBJECT_CLASS_MODS",
		"80590046": "NS_ERROR_LDAP_RESULTS_TOO_LARGE",
		"80590047": "NS_ERROR_LDAP_AFFECTS_MULTIPLE_DSAS",
		"80590050": "NS_ERROR_LDAP_OTHER",
		"80590051": "NS_ERROR_LDAP_SERVER_DOWN",
		"80590052": "NS_ERROR_LDAP_LOCAL_ERROR",
		"80590053": "NS_ERROR_LDAP_ENCODING_ERROR",
		"80590054": "NS_ERROR_LDAP_DECODING_ERROR",
		"80590055": "NS_ERROR_LDAP_TIMEOUT",
		"80590056": "NS_ERROR_LDAP_AUTH_UNKNOWN",
		"80590057": "NS_ERROR_LDAP_FILTER_ERROR",
		"80590058": "NS_ERROR_LDAP_USER_CANCELLED",
		"80590059": "NS_ERROR_LDAP_PARAM_ERROR",
		"8059005a": "NS_ERROR_LDAP_NO_MEMORY",
		"8059005b": "NS_ERROR_LDAP_CONNECT_ERROR",
		"8059005c": "NS_ERROR_LDAP_NOT_SUPPORTED",
		"8059005d": "NS_ERROR_LDAP_CONTROL_NOT_FOUND",
		"8059005e": "NS_ERROR_LDAP_NO_RESULTS_RETURNED",
		"8059005f": "NS_ERROR_LDAP_MORE_RESULTS_TO_RETURN",
		"80590060": "NS_ERROR_LDAP_CLIENT_LOOP",
		"80590061": "NS_ERROR_LDAP_REFERRAL_LIMIT_EXCEEDED",
		"805a0400": "NS_ERROR_CMS_VERIFY_NOT_SIGNED",
		"805a0401": "NS_ERROR_CMS_VERIFY_NO_CONTENT_INFO",
		"805a0402": "NS_ERROR_CMS_VERIFY_BAD_DIGEST",
		"805a0404": "NS_ERROR_CMS_VERIFY_NOCERT",
		"805a0405": "NS_ERROR_CMS_VERIFY_UNTRUSTED",
		"805a0407": "NS_ERROR_CMS_VERIFY_ERROR_UNVERIFIED",
		"805a0408": "NS_ERROR_CMS_VERIFY_ERROR_PROCESSING",
		"805a0409": "NS_ERROR_CMS_VERIFY_BAD_SIGNATURE",
		"805a040a": "NS_ERROR_CMS_VERIFY_DIGEST_MISMATCH",
		"805a040b": "NS_ERROR_CMS_VERIFY_UNKNOWN_ALGO",
		"805a040c": "NS_ERROR_CMS_VERIFY_UNSUPPORTED_ALGO",
		"805a040d": "NS_ERROR_CMS_VERIFY_MALFORMED_SIGNATURE",
		"805a040e": "NS_ERROR_CMS_VERIFY_HEADER_MISMATCH",
		"805a040f": "NS_ERROR_CMS_VERIFY_NOT_YET_ATTEMPTED",
		"805a0410": "NS_ERROR_CMS_VERIFY_CERT_WITHOUT_ADDRESS",
		"805a0420": "NS_ERROR_CMS_ENCRYPT_NO_BULK_ALG",
		"805a0421": "NS_ERROR_CMS_ENCRYPT_INCOMPLETE",
		"805b0033": "NS_ERROR_DOM_INVALID_EXPRESSION_ERR",
		"805b0034": "NS_ERROR_DOM_TYPE_ERR",
		"805c0001": "NS_ERROR_DOM_RANGE_BAD_BOUNDARYPOINTS_ERR",
		"805c0002": "NS_ERROR_DOM_RANGE_INVALID_NODE_TYPE_ERR",
		"805d0001": "NS_ERROR_WONT_HANDLE_CONTENT",
		"805d001e": "NS_ERROR_MALWARE_URI",
		"805d001f": "NS_ERROR_PHISHING_URI",
		"805e0008": "NS_ERROR_IMAGE_SRC_CHANGED",
		"805e0009": "NS_ERROR_IMAGE_BLOCKED",
		"805e000a": "NS_ERROR_CONTENT_BLOCKED",
		"805e000b": "NS_ERROR_CONTENT_BLOCKED_SHOW_ALT",
		"805e000e": "NS_PROPTABLE_PROP_NOT_THERE",
		"80600001": "NS_ERROR_XSLT_PARSE_FAILURE",
		"80600002": "NS_ERROR_XPATH_PARSE_FAILURE",
		"80600003": "NS_ERROR_XSLT_ALREADY_SET",
		"80600004": "NS_ERROR_XSLT_EXECUTION_FAILURE",
		"80600005": "NS_ERROR_XPATH_UNKNOWN_FUNCTION",
		"80600006": "NS_ERROR_XSLT_BAD_RECURSION",
		"80600007": "NS_ERROR_XSLT_BAD_VALUE",
		"80600008": "NS_ERROR_XSLT_NODESET_EXPECTED",
		"80600009": "NS_ERROR_XSLT_ABORTED",
		"8060000a": "NS_ERROR_XSLT_NETWORK_ERROR",
		"8060000b": "NS_ERROR_XSLT_WRONG_MIME_TYPE",
		"8060000c": "NS_ERROR_XSLT_LOAD_RECURSION",
		"8060000d": "NS_ERROR_XPATH_BAD_ARGUMENT_COUNT",
		"8060000e": "NS_ERROR_XPATH_BAD_EXTENSION_FUNCTION",
		"8060000f": "NS_ERROR_XPATH_PAREN_EXPECTED",
		"80600010": "NS_ERROR_XPATH_INVALID_AXIS",
		"80600011": "NS_ERROR_XPATH_NO_NODE_TYPE_TEST",
		"80600012": "NS_ERROR_XPATH_BRACKET_EXPECTED",
		"80600013": "NS_ERROR_XPATH_INVALID_VAR_NAME",
		"80600014": "NS_ERROR_XPATH_UNEXPECTED_END",
		"80600015": "NS_ERROR_XPATH_OPERATOR_EXPECTED",
		"80600016": "NS_ERROR_XPATH_UNCLOSED_LITERAL",
		"80600017": "NS_ERROR_XPATH_BAD_COLON",
		"80600018": "NS_ERROR_XPATH_BAD_BANG",
		"80600019": "NS_ERROR_XPATH_ILLEGAL_CHAR",
		"8060001a": "NS_ERROR_XPATH_BINARY_EXPECTED",
		"8060001b": "NS_ERROR_XSLT_LOAD_BLOCKED_ERROR",
		"8060001c": "NS_ERROR_XPATH_INVALID_EXPRESSION_EVALUATED",
		"8060001d": "NS_ERROR_XPATH_UNBALANCED_CURLY_BRACE",
		"8060001e": "NS_ERROR_XSLT_BAD_NODE_NAME",
		"8060001f": "NS_ERROR_XSLT_VAR_ALREADY_SET",
		"80620000": "NS_ERROR_DOM_SVG_WRONG_TYPE_ERR",
		"80620001": "NS_ERROR_DOM_SVG_INVALID_VALUE_ERR",
		"80620002": "NS_ERROR_DOM_SVG_MATRIX_NOT_INVERTABLE",
		"80630001": "MOZ_ERROR_STORAGE_ERROR",
		"80640001": "NS_ERROR_SCHEMAVALIDATOR_NO_SCHEMA_LOADED",
		"80640002": "NS_ERROR_SCHEMAVALIDATOR_NO_DOM_NODE_SPECIFIED",
		"80640003": "NS_ERROR_SCHEMAVALIDATOR_NO_TYPE_FOUND",
		"80640004": "NS_ERROR_SCHEMAVALIDATOR_TYPE_NOT_FOUND",
		"80650000": "NS_ERROR_DOM_FILE_NOT_FOUND_ERR",
		"80650001": "NS_ERROR_DOM_FILE_NOT_READABLE_ERR",
		"80780001": "NS_ERROR_SCHEMA_NOT_SCHEMA_ELEMENT",
		"80780002": "NS_ERROR_SCHEMA_UNKNOWN_TARGET_NAMESPACE",
		"80780003": "NS_ERROR_SCHEMA_UNKNOWN_TYPE",
		"80780004": "NS_ERROR_SCHEMA_UNKNOWN_PREFIX",
		"80780005": "NS_ERROR_SCHEMA_INVALID_STRUCTURE",
		"80780006": "NS_ERROR_SCHEMA_INVALID_TYPE_USAGE",
		"80780007": "NS_ERROR_SCHEMA_MISSING_TYPE",
		"80780008": "NS_ERROR_SCHEMA_FACET_VALUE_ERROR",
		"80780009": "NS_ERROR_SCHEMA_LOADING_ERROR",
		"8078000a": "IPC_WAIT_NEXT_MESSAGE",
		"80780021": "NS_ERROR_UNORM_MOREOUTPUT",
		"807803e9": "NS_ERROR_WEBSHELL_REQUEST_REJECTED",
		"807807d1": "NS_ERROR_DOCUMENT_IS_PRINTMODE",
		"80780bb9": "NS_ERROR_XFORMS_CALCULATION_EXCEPTION",
		"80780bba": "NS_ERROR_XFORMS_UNION_TYPE"
	}
};
// ************************************************************************************************