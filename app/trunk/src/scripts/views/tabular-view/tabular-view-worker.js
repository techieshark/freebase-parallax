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


function tabularViewRender(div, job, rows, settings) {
    div.innerHTML = "";
    if (rows.length == 0) {
        return;
    }
    
    var table = document.createElement("table");
    //table.setAttribute("border", "1");
    table.setAttribute("cellspacing", "0");
    table.setAttribute("cellpadding", "2");
    table.setAttribute("width", "100%");
    div.appendChild(table);
    
    var columnCount = job.columnConfigs.length + (settings.editable ? 1 : 0);
    
    /*
     *  Create table header and edit rows
     */
     
    var trHead = table.insertRow(0);
    var trEdit = table.insertRow(1);
    var tdEdit = trEdit.insertCell(0);
    tdEdit.setAttribute("colspan", columnCount);
    tdEdit.className = "tabular-view-header-editing-container";
    trEdit.style.display = "none";
    
    var createColumnHeader = function(columnConfig, c) {
        var td = trHead.insertCell(c);
        
        if (c > 0 && settings.editable) {
            var img = SimileAjax.Graphics.createTranslucentImage("images/close-button.png", "middle");
            img.className = "tabular-view-header-remove-button";
            img.onclick = function() { settings.onRemoveColumn(img, c); }
            td.appendChild(img);
            
            var aEditColumn = document.createElement("a");
            aEditColumn.className = "action tabular-view-header-edit-button";
            aEditColumn.href = "javascript:{}";
            aEditColumn.innerHTML = "edit";
            aEditColumn.onclick = function() { td.className = "tabular-view-header-editing"; settings.onEditColumn(aEditColumn, c, tdEdit); };
            td.appendChild(aEditColumn);
        }
        
        var spanLabel = document.createElement("span");
        spanLabel.className = "tabular-view-header-label";
        spanLabel.appendChild(document.createTextNode("label" in columnConfig ? columnConfig.label : "?"));
        td.appendChild(spanLabel);
    };
    for (var c = 0; c < job.columnConfigs.length; c++) {
        var columnConfig = job.columnConfigs[c];
        createColumnHeader(columnConfig, c);
    }
    
    if (settings.editable) {
        var tdAdd = trHead.insertCell(job.columnConfigs.length);
        tdAdd.setAttribute("width", "1%");
        
        var aAddColumn = document.createElement("a");
        aAddColumn.className = "action";
        aAddColumn.href = "javascript:{}";
        aAddColumn.innerHTML = "add";
        aAddColumn.onclick = function() { tdAdd.className = "tabular-view-header-editing"; settings.onAddColumn(aAddColumn, tdEdit); };
        tdAdd.appendChild(aAddColumn);
    }
    
    /*
     *  Create table data rows
     */
    var createTopicValue = function(valueEntry) {
        var a = document.createElement("a");
        a.href = "http://www.freebase.com/view" + valueEntry.id;
        a.appendChild(document.createTextNode(valueEntry.name));
        $(a).click(function(evt) { 
            Logging.log("tabular-view-to-topic", { "id" : valueEntry.id });
            settings.onFocus(valueEntry.id, valueEntry.name);
            evt.preventDefault();
        });
        return a;
    };
    var createValue = function(valueEntry) {
        if ("name" in valueEntry) {
            return createTopicValue(valueEntry);
        } else {
            return document.createTextNode(valueEntry.value);
        }
    };
    for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        var tr = table.insertRow(r + 2);
        
        var cells = row.cells;
        for (var c = 0; c < cells.length; c++) {
            var cell = cells[c];
            var td = tr.insertCell(c);
            td.className = "tabular-view-data-cell";
            
            var values = cell.values;
            if (values.length == 0) {
                td.innerHTML = "&nbsp;";
            } else if (values.length == 1) {
                td.appendChild(createValue(values[0]));
            } else {
                var ol = document.createElement("ol");
                td.appendChild(ol);
                
                for (var v = 0; v < values.length; v++) {
                    var value = values[v];
                    var li = document.createElement("li");
                    ol.appendChild(li);
                    li.appendChild(createValue(value));
                }
            }
        }
    }
};
