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

// tree implementation for request/response output on main window
function HttpFoxTree(treeElement, HttpFoxControllerReference)
{
	this.init(treeElement, HttpFoxControllerReference);
}

HttpFoxTree.prototype = 
{
	HttpFox: null,
	TreeElement: null,
	selection: null,
	
	init: function(treeElement, HttpFoxControllerReference)
	{
		this.HttpFox = HttpFoxControllerReference;
		
		this.TreeElement = treeElement;
		this.TreeElement.view = this;
	},
	
	get rowCount() 
	{
		return this.HttpFox.FilteredRequests.length;
	},

	getCellText: function(row, column) 
	{
		var request = this.HttpFox.FilteredRequests[row];
		var rString;
		
		if (request)
		{
			// in deer park, the column is actually a tree column, rather than an id
			if (column.id)
			{
				column = column.id;
			}
			
			switch(column)
			{
				case "hf_Column_Started":
					return net.decoded.utils.formatTime(new Date(request.StartTimestamp - this.HttpFox.HttpFoxService.StartTime.getTime()));
					
				case "hf_Column_Time":
					if (!request.IsFinished)
					{
						return "*";
					}

					return net.decoded.utils.formatTimeDifference(request.StartTimestamp, request.EndTimestamp);
					
				case "hf_Column_Sent":
					rString = "";
					
					if (request.IsSending)
					{
						rString = net.decoded.utils.humanizeSize(request.getBytesSent(), 6) + "/" + net.decoded.utils.humanizeSize(request.getBytesSentTotal(), 6);
					}
					else
					{
						rString = net.decoded.utils.humanizeSize(request.getBytesSentTotal(), 6);	
					}
					
					return rString;
					
				case "hf_Column_Received":
					rString = "";
					
					/*if (request.IsAborted)
					{
						return rString;
					}*/
					
					if (request.IsSending)
					{
						return "*";
					}
					
					if (!request.IsFinished)
					{
						// show loading body progress
						rString = net.decoded.utils.humanizeSize(request.getBytesLoaded(), 6) + "/" + net.decoded.utils.humanizeSize(request.getBytesLoadedTotal(), 6);
					}
					else
					{
						rString = net.decoded.utils.humanizeSize(request.getBytesLoaded(), 6);	
					}
					
					if (request.IsFromCache || request.ResponseStatus == 304)
					{
						rString = "(" + rString + ")";
					}
					
					return rString;
					
				case "hf_Column_Method":
					return request.RequestMethod;
					
				case "hf_Column_Result":
					if (request.IsAborted)
					{
						return "(Aborted)";
					}
					
					if (request.isError())
					{
						return "(Error)";
					}
				
					if (request.IsFromCache && (request.ResponseStatus != 304))
					{
						return "(Cache)";
					}
					
					if (!request.HasReceivedResponseHeaders && !request.IsFinal)
					{
						return "*";
					}	
						
					return request.ResponseStatus;
					
				case "hf_Column_Type":
					if (request.hasErrorCode())
					{
						if (request.ContentType)
						{
							return request.ContentType + " (" + net.decoded.utils.nsResultErrors[request.Status.toString(16)] + ")";
						}
						
						return net.decoded.utils.nsResultErrors[request.Status.toString(16)];
					}
					
					if (!request.HasReceivedResponseHeaders && !request.IsFromCache && !request.IsFinal)
					{
						return "*";
					}
					
					if (request.isRedirect())
					{
						if (request.ResponseHeaders && request.ResponseHeaders.Location)
						{
							return "Redirect to: " + request.ResponseHeaders.Location;
						}
						return "Redirect (cached)";
					}
					
					return request.ContentType;
					
				case "hf_Column_URL":
					return request.Url;
					
				default:
					return "bad column: " + column;
			}
		}
		else
		{
			return "Bad row: " + row;
		}
	},

	setTree: function(treebox)
	{ 
		this.treebox = treebox; 
	},

	isContainer: function(row) 
	{
		return false; 
	},
	isSeparator: function(row) 
	{ 
		return false; 
	},
	isSorted: function(row) 
	{ 
		return false; 
	},
	getLevel: function(row)
	{ 
		return 0; 
	},
	getImageSrc: function(row, col)
	{ 
		return null; 
	},
	
	getRowProperties: function(row, props) 
	{
		var aserv = Components.classes["@mozilla.org/atom-service;1"].getService(Components.interfaces.nsIAtomService);
		var request = this.HttpFox.FilteredRequests[row];
		var returnProps = "";
		
		if (this.TreeElement.currentIndex == row) 
		{
			if (props) 
			{
				props.AppendElement(aserv.getAtom("hf_currentRow"));	
			}
			else 
			{
				// gecko 22+
				returnProps += "hf_currentRow" + " ";
			}
		}
		
		if (this.TreeElement.view.selection.isSelected(row)) 
		{
			if (props) 
			{
				return;
			}
			else 
			{
				// gecko 22+
				return returnProps;
			}
		}
		
		if (!this.HttpFox.HttpFoxService.Preferences.ColorRequests)
		{
			if (props) 
			{
				return;
			}
			else 
			{
				// gecko 22+
				return returnProps;
			}
		}
		
		if (request.isHTTPS()) 
		{
			if (props) 
			{
				props.AppendElement(aserv.getAtom("hf_HTTPS"));	
			}
			else 
			{
				// gecko 22+
				returnProps += "hf_HTTPS" + " ";
			}
		}
		
		if (request.IsFromCache || request.ResponseStatus == 304) 
		{
			if (props) 
			{
				props.AppendElement(aserv.getAtom("hf_fromCache"));	
				return;
			}
			else 
			{
				// gecko 22+
				returnProps += "hf_fromCache" + " ";
				return returnProps;
			}
		}
		
		if (request.isRedirect()) 
		{
			if (props) 
			{
				props.AppendElement(aserv.getAtom("hf_isRedirect"));	
				return;
			}
			else 
			{
				// gecko 22+
				returnProps += "hf_isRedirect" + " ";
				return returnProps;
			}
		}
		
		if (request.isError()) 
		{
			if (props) 
			{
				props.AppendElement(aserv.getAtom("hf_isError"));	
				return;
			}
			else 
			{
				// gecko 22+
				returnProps += "hf_isError" + " ";
				return returnProps;
			}
		}
		
		if (request.hasErrorCode() || request.ResponseStatus >= 400) 
		{
			if (props) 
			{
				props.AppendElement(aserv.getAtom("hf_hasError"));	
				return;
			}
			else 
			{
				// gecko 22+
				returnProps += "hf_hasError" + " ";
				return returnProps;
			}
		}
		
		if (request.IsFinished && request.ResponseStatus == 200) 
		{
			if (props) 
			{
				props.AppendElement(aserv.getAtom("hf_OK"));	
			}
			else 
			{
				// gecko 22+
				returnProps += "hf_OK" + " ";
			}
		}
		
		if (props) 
		{
			return;			
		}
		else 
		{
			// gecko 22+
			return returnProps;
		}
	},
	
	getCellProperties: function(row, col, props)
	{
		var aserv = Components.classes["@mozilla.org/atom-service;1"].getService(Components.interfaces.nsIAtomService);
		var request = this.HttpFox.FilteredRequests[row];
		var returnProps = "";
		
		if (this.TreeElement.view.selection.isSelected(row)) 
		{
			if (props) 
			{ 
				return; 
			}
			else 
			{
				// Gecko 22+
				return returnProps;
			}
		}
		
		if (!this.HttpFox.HttpFoxService.Preferences.ColorRequests)
		{
			if (props) 
			{ 
				return; 
			}
			else 
			{
				// Gecko 22+
				return returnProps;
			}
		}
		
		if (request.IsFromCache) 
		{
			if (props) 
			{
				props.AppendElement(aserv.getAtom("hf_fromCache"));
			}
			else 
			{
				// Gecko 22+
				returnProps += "hf_fromCache" + " ";
			}
		}
		
		if (request.isError()) 
		{
			if (props) 
			{
				props.AppendElement(aserv.getAtom("hf_isError"));
				return;
			}
			else 
			{
				// Gecko 22+
				returnProps += "hf_isError" + " ";
				return returnProps;
			}
		}
		
		if (request.isHTTPS()) 
		{
			if (props) 
			{
				props.AppendElement(aserv.getAtom("hf_HTTPS"));
			}
			else 
			{
				// Gecko 22+
				returnProps += "hf_HTTPS" + " ";
			}
		}
		
		if (props) 
		{
			return;			
		}
		else 
		{
			// gecko 22+
			return returnProps;
		}
	},

	getColumnProperties: function(colid, col, props)
	{
		if (props) 
		{
			return;			
		}
		else 
		{
			// gecko 22+
			return "";
		}
	},

	rowCountChanged: function(index, count) 
	{
		//dump('\nROWCOUNT CHANGED (' + index + ', ' + count + ')\n');
		//alert(this.treebox);
		if (this.treebox) 
		{
			var lvr = this.treebox.getLastVisibleRow();
			this.treebox.rowCountChanged(index, count);
			// If the last line of the tree is visible on screen, we will autoscroll
			//if ((lvr + 1) >= index || this.HttpFox.isAutoScroll())
			if (this.HttpFox.isAutoScroll())
			{
				this.treebox.ensureRowIsVisible(this.rowCount - 1);
			}
		}
		if (this.rowCount > 0) 
		{
			//this.gui.hasVisibleData = true;
		} 
		else 
		{
			//this.gui.hasVisibleData = false;
		}
	},

	invalidateRow: function(index) 
	{
		if (this.treebox) 
		{
			this.treebox.invalidateRow(index);
		}
	},
	
	invalidate: function()
	{
		this.treebox.invalidate();
	},

	getCurrent: function() 
	{
		if (this.HttpFox.FilteredRequests[this.TreeElement.currentIndex]) 
		{
			return this.HttpFox.FilteredRequests[this.TreeElement.currentIndex];
		} 
		else
		{
			return null;
		}
	},
	
	setCurrent: function(index)
	{
		this.TreeElement.currentIndex = index;
		this.invalidate();
	},
	
	setCurrentToNewest: function()
	{
		this.TreeElement.currentIndex = this.rowCount;
		this.invalidate();
	}
};