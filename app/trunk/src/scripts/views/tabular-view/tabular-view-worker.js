function tabularViewQuery(job, onDone) {
	var queryNode = job.queryNode;
	queryNode["limit"] = 500;
	
	var addPath = function(path, valuesAreNative) {
		if (path.length > 0) {
			var queryNode2 = extendQueryNodeWithPath(queryNode, path);
			if (valuesAreNative) {
				queryNode2["value"] = null;
			} else {
				if (!("name" in queryNode2)) {
					queryNode2["name"] = null;
				}
				if (!("id" in queryNode2)) {
					queryNode2["id"] = null;
				}
			}
		}
	};
	
	if (job.hasRowColor) {
		addPath(job.rowColorPath, job.rowColorValuesAreNative);
        var rowColorNodeIterator = createForwardPathIterator(job.rowColorPath);
    }
	
	for (var i = 0; i < job.columnConfigs.length; i++) {
		var columnConfig = job.columnConfigs[i];
		if ("path" in columnConfig) {
			addPath(columnConfig.path, columnConfig.valuesAreNative);
	        columnConfig.nodeIterator = createForwardPathIterator(columnConfig.path);
		}
	}
	
    var gotRestrictedItems = function(o) {
        var rows = [];
        var rowColorKeys = job.rowColorKeys;
        
        job.hasRowColorKeys = false;
        var processRow = function(itemNode) {
            var row = {
				cells: []
            };
            
            if (job.hasRowColor) {
                var colorNode = null;
                rowColorNodeIterator(itemNode,
                    function(node) {
                        colorNode = node;
                    }
                );
                if (colorNode != null) {
                    var key = "name" in colorNode ? colorNode.name : colorNode.value;
                    var color = job.colorCoder.getColorForKey(key);
                    
                    rowColorKeys[key] = true;
                    job.hasRowColorKeys = true;
                    
                    row.color = color;
                }
            }
			
			for (var c = 0; c < job.columnConfigs.length; c++) {
				var columnConfig = job.columnConfigs[c];
				var cell = { values: [] };
				if ("nodeIterator" in columnConfig) {
					var valueNodeVisitor = function(valueNode) {
						if ("name" in valueNode) {
							cell.values.push({ name: valueNode.name, id: valueNode.id });
							if (cell.values.length == 1) {
								cell.sortKey = valueNode.name;
							}
						} else {
							cell.values.push({ value: valueNode.value });
							if (cell.values.length == 1) {
								cell.sortKey = valueNode.value.toString();
							}
						}
					};
					
				    columnConfig.nodeIterator(itemNode, valueNodeVisitor);
				}
				
				row.cells.push(cell);
			}
			
            rows.push(row);
        };
        
        for (var i = 0; i < o.result.length; i++) {
            var itemNode = o.result[i];
			processRow(itemNode);
        }
        
        onDone(rows);
    };
    
    JsonpQueue.queryOne([queryNode], gotRestrictedItems, genericErrorHandler);
};


function tabularViewRender(div, job, rows, onAddColumn, onRemoveColumn) {
	div.innerHTML = "";
    if (rows.length == 0) {
        return;
    }
    
    var table = document.createElement("table");
	table.setAttribute("border", "1");
	table.setAttribute("cellpadding", "2");
	table.setAttribute("width", "100%");
	div.appendChild(table);
	
	var trHead = table.insertRow(0);
	var createColumnHeader = function(columnConfig, c) {
		var td = trHead.insertCell(c);
		
		var divLabel = document.createElement("div");
		divLabel.className = "tabular-view-header-label";
		td.appendChild(divLabel);
		
		divLabel.appendChild(document.createTextNode("label" in columnConfig ? columnConfig.label : "?"));
		if (c > 0) {
			var img = SimileAjax.Graphics.createTranslucentImage("images/close-button.png", "middle");
			img.onclick = function() { onRemoveColumn(c); }
			divLabel.appendChild(img);
		}
		
		if (c > 0) {
			//var div
		}
	};
	for (var c = 0; c < job.columnConfigs.length; c++) {
		var columnConfig = job.columnConfigs[c];
		createColumnHeader(columnConfig, c);
	}
	
	var tdAdd = trHead.insertCell(job.columnConfigs.length);
	tdAdd.setAttribute("width", "1%");
	
	var a = document.createElement("a");
	a.href = "javascript:{}";
	a.innerHTML = "add";
	a.onclick = onAddColumn;
	tdAdd.appendChild(a);
	
	for (var r = 0; r < rows.length; r++) {
		var row = rows[r];
		var tr = table.insertRow(r + 1);
		
		var cells = row.cells;
		for (var c = 0; c < cells.length; c++) {
			var cell = cells[c];
			var td = tr.insertCell(c);
			
			var values = cell.values;
			for (var v = 0; v < values.length; v++) {
				var value = values[v];
				if (v > 0) {
					td.appendChild(document.createTextNode(", "));
				}
				
				if ("name" in value) {
					td.appendChild(document.createTextNode(value.name));
				} else {
					td.appendChild(document.createTextNode(value.value));
				}
			}
		}
	}
};
