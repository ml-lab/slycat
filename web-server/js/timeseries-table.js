/*
Copyright 2013, Sandia Corporation. Under the terms of Contract
DE-AC04-94AL85000 with Sandia Corporation, the U.S. Government retains certain
rights in this software.
*/

////////////////////////////////////////////////////////////////////////////////////////
// Slickgrid-based data table widget, for use with the timeseries model.

$.widget("timeseries.table",
{
  options:
  {
    "server-root" : "",
    mid : null,
    aid : null,
    metadata : null,
    "row-selection" : [],
    "variable-selection": [],
    "sort-variable" : null,
    "sort-order" : null,
    colormap : null,
    table_filter : [],
    waveform_indexes : [],
    selection : null,
    row_count : null,
  },

  _create: function()
  {
  	var self = this;

  	function value_formatter(value)
    {
      return value == null ? "&nbsp;" : (value + "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    }

  	function cell_formatter(row, cell, value, columnDef, dataContext)
    {
      if(columnDef.colormap)
        return "<div class='highlightWrapper' style='background:" + columnDef.colormap(value) + "'>" + value_formatter(value) + "</div>";
      return value_formatter(value);
    }

  	function make_column(column_index, header_class, cell_class)
    {
      return {
        id : column_index,
        field : column_index,
        name : self.options.metadata["column-names"][column_index],
        sortable : false,
        headerCssClass : header_class,
        cssClass : cell_class,
        formatter : cell_formatter,
        // header :
        // {
        //   buttons :
        //   [
        //     {
        //       cssClass : self.options["sort-variable"] == column_index ? (self.options["sort-order"] == "ascending" ? "icon-sort-ascending" : "icon-sort-descending") : "icon-sort-off",
        //       tooltip : self.options["sort-variable"] == column_index ? (self.options["sort-order"] == "ascending" ? "Sort descending" : "Sort ascending") : "Sort ascending",
        //       command : self.options["sort-variable"] == column_index ? (self.options["sort-order"] == "ascending" ? "sort-descending" : "sort-ascending") : "sort-ascending"
        //     }
        //   ]
        // }
      };
    }

    self.columns = [];
    self.columns.push(make_column(self.options.metadata["column-count"]-1, "headerSimId", "rowSimId")); // Last column is added as simid
    for(var i = 0; i < self.options.metadata["column-count"]-1; i++) // rest of columns are added as inputs
      self.columns.push(make_column(i, "headerInput", "rowInput"));

  	self.columns;
  },

  resize_canvas: function()
  {
    var self = this;
    self.grid.resizeCanvas();
  },

  _setOption: function(key, value)
  {
    var self = this;

    if(key == "row-selection")
    {
      if(self._array_equal(self.options[key], value))
        return;

      self.options[key] = value;

      // This does not work for filtered rows
      // self.data.get_indices("sorted", value, function(sorted_rows)
      // {
      //   self.trigger_row_selection = false;
      //   self.grid.setSelectedRows(sorted_rows);
      //   if(sorted_rows.length)
      //     self.grid.scrollRowToTop(sorted_rows[0]);
      // });
      var selected_rows = [];
      for(var i=0; i<value.length; i++) {
        selected_rows.push( self.options.table_filter.indexOf(value[i]) );
      }
      self.grid.setSelectedRows(selected_rows);
      if(selected_rows.length)
        self.grid.scrollRowToTop(selected_rows[0]);
    }
    else if(key == "variable-selection")
    {
      if(self._array_equal(self.options[key], value))
        return;

      self.options[key] = value;
      self._color_variables(value);
    }
    else if(key == "colormap")
    {
      self.options[key] = value;
      self._color_variables(self.options["variable-selection"])
    }
    else if(key == "selection")
    {
      self.options[key] = value;

      var data_table_index, waveform_index;
      var table_filter = [];
      var waveform_indexes = [];
      $.each(value, function(index, node)
      {
        data_table_index = node["data-table-index"];
        waveform_index   = node["waveform-index"];

        if(data_table_index == null)
          return;

        table_filter.push(data_table_index);
        waveform_indexes.push(waveform_index);
      });
      self.options.table_filter = table_filter;
      self.options.waveform_indexes = waveform_indexes;
      self.options.row_count = table_filter.length;

      self.data = new self._data_provider({
        server_root : self.options["server-root"],
        mid : self.options.mid,
        aid : self.options.aid,
        metadata : self.options.metadata,
        sort_column : self.options["sort-variable"],
        sort_order : self.options["sort-order"],
        table_filter : self.options.table_filter,
        row_count : self.options.row_count,
        });

      if(self.grid) {
        self.grid.setData(self.data);
        self.grid.invalidate();
      }
      else {
        self.trigger_row_selection = true;
        self.grid = new Slick.Grid(self.element, self.data, self.columns, {explicitInitialization : true, enableColumnReorder : false});
        self.grid.setSelectionModel(new Slick.RowSelectionModel());
        self.grid.onSelectedRowsChanged.subscribe(function(e, selection)
        {
          // Don't trigger a selection event unless the selection was changed by user interaction (i.e. not outside callers or changing the sort order).
          if(self.trigger_row_selection)
          {
            var waveform_indexes=[];
            for(var i=0; i<selection.rows.length; i++){
              waveform_indexes.push( self.grid.getDataItem(selection.rows[i])[self.options.metadata["column-count"]-1] );
            }
            self.options["row-selection"] = waveform_indexes;
            self.element.trigger("row-selection-changed", [waveform_indexes]);
          }
          self.trigger_row_selection = true;
        });
        self.grid.init();
      }
    }
  },

  _data_provider: function(parameters)
  {
    var self = this;

    self.server_root = parameters.server_root
    self.mid = parameters.mid;
    self.aid = parameters.aid;
    self.metadata = parameters.metadata;
    self.sort_column = parameters.sort_column;
    self.sort_order = parameters.sort_order;
    self.table_filter = parameters.table_filter;
    self.row_count = parameters.row_count;

    self.pages = {};
    self.page_size = 50;

    self.getLength = function()
    {
      //return self.metadata["row-count"];
      return self.row_count;
    }

    self.getItem = function(index)
    {
      var column_begin = 0;
      var column_end = self.metadata["column-count"];
      var page = Math.floor(index / self.page_size);
      var page_begin = page * self.page_size;

      if(!(page in self.pages))
      {
        var row_begin = page_begin;
        var row_end = (page + 1) * self.page_size;

        var sort = "";
        if(self.sort_column !== null && self.sort_order !== null)
          sort = "&sort=" + self.sort_column + ":" + self.sort_order;

        var rowsToRetrieve = self.table_filter.slice(row_begin, row_end ).join(',');

        $.ajax(
        {
          type : "GET",
          url : self.server_root + "models/" + self.mid + "/tables/" + self.aid + "/arrays/0/chunk?rows=" + rowsToRetrieve + "&columns=" + column_begin + "-" + column_end + "&index=Index" + sort,
          async : false,
          success : function(data)
          {
            self.pages[page] = data;
          },
          error: function(request, status, reason_phrase)
          {
            console.log("error", request, status, reason_phrase);
          }
        });
      }

      result = {};
      for(var i = column_begin; i != column_end; ++i)
        result[i] = self.pages[page].data[i][index - page_begin];
      return result;
    }

    self.getItemMetadata = function(index)
    {
      return null;
    }

    self.set_sort = function(column, order)
    {
      if(column == self.sort_column && order == self.sort_order)
        return;
      self.sort_column = column;
      self.sort_order = order;
      self.pages = {};
    },

    self.get_indices = function(direction, rows, callback)
    {
      if(rows.length == 0)
      {
        callback([]);
        return;
      }

      var sort = "";
      if(self.sort_column !== null && self.sort_order !== null)
        sort = "&sort=" + self.sort_column + ":" + self.sort_order;

      var row_string = "";
      for(var i = 0; i < rows.length; ++i)
      {
        row_string += rows[i];
        break
      }
      for(var i = 1; i < rows.length; ++i)
      {
        row_string += ",";
        row_string += rows[i];
      }

      function is_little_endian()
      {
        if(this.result === undefined)
          this.result = ((new Uint32Array((new Uint8Array([1,2,3,4])).buffer))[0] === 0x04030201);
        return this.result;
      }

      var request = new XMLHttpRequest();
      request.open("GET", self.server_root + "models/" + self.mid + "/tables/" + self.aid + "/arrays/0/" + direction + "-indices?rows=" + row_string + "&index=Index&byteorder=" + (is_little_endian() ? "little" : "big") + sort);
      request.responseType = "arraybuffer";
      request.callback = callback;
      request.onload = function(e)
      {
        this.callback(new Int32Array(this.response));
      }
      request.send();
    }
  },

  _array_equal: function(a, b)
  {
    return $(a).not(b).length == 0 && $(b).not(a).length == 0;
  },
});