/*
Copyright 2013, Sandia Corporation. Under the terms of Contract
DE-AC04-94AL85000 with Sandia Corporation, the U.S. Government retains certain
rights in this software.
*/

define("slycat-cca-model", ["slycat-server-root", "domReady!"], function(server_root)
{
  //////////////////////////////////////////////////////////////////////////////////////////
  // Setup global variables.
  //////////////////////////////////////////////////////////////////////////////////////////

  var model = {_id: location.pathname.substr(8)};
  var input_columns = null;
  var output_columns = null;
  var scale_inputs = null;

  var bookmarker = null;
  var bookmark = null;

  var x_loadings = null;
  var y_loadings = null;
  var indices = null;
  var x = null;
  var y = null;
  var v = null;
  var r2 = null;
  var wilks = null;
  var table_metadata = null;

  var generate_indices = false;
  var barplot_ready = false;
  var scatterplot_ready = false;
  var table_ready = false;
  var legend_ready = false;

  //////////////////////////////////////////////////////////////////////////////////////////
  // Get the model
  //////////////////////////////////////////////////////////////////////////////////////////

  $.ajax(
  {
    type : "GET",
    url : server_root + "models/" + model._id,
    success : function(result)
    {
      model = result;
      bookmarker = new bookmark_manager(server_root, model.project, model._id);
      input_columns = model["artifact:input-columns"];
      output_columns = model["artifact:output-columns"];
      scale_inputs = model["artifact:scale-inputs"];
      setup_page();
    },
    error: function(request, status, reason_phrase)
    {
      window.alert("Error retrieving model: " + reason_phrase);
    }
  });

  //////////////////////////////////////////////////////////////////////////////////////////
  // If the model is ready, start retrieving data, including bookmarked state.
  //////////////////////////////////////////////////////////////////////////////////////////

  function setup_page()
  {
    if(model["state"] == "waiting" || model["state"] == "running")
    {
      $("#status-messages").empty().html(
        "<div class='error-heading'>Oops, this model isn't ready yet.</div>" +
        "<div class='error-description'>We're probabably building it for you right now. Watch the status bar for progress information and more details.</div>");
      show_status_messages();
    }
    else if(model["state"] == "closed" && model["result"] === null)
    {
      $("#status-messages").empty().html(
        "<div class='error-heading'>Oops, it looks like this model was never completed.</div>" +
        "<div class='error-description'>Here's the last thing that was happening before it was closed:</div>" +
        "<pre>" + model["message"] + "</pre>");
      show_status_messages();
    }
    else if(model["result"] == "failed")
    {
      $("#status-messages").empty().html(
        "<div class='error-heading'>Oops, it looks like this model failed to build.</div>" +
        "<div class='error-description'>Here's what was happening when it ended:</div>" +
        "<pre>" + model["message"] + "</pre>");
      show_status_messages();
    }
    else
    {
      // Display progress as the load happens ...
      $(".load-status").text("Loading data.");

      // Mark this model as closed, so it doesn't show-up in the header anymore.
      $.ajax(
      {
        type : "PUT",
        url : server_root + "models/" + model._id,
        contentType : "application/json",
        data : $.toJSON({
          "state" : "closed"
        }),
        processData : false
      });

      // Load the x_loadings artifact.
      get_model_array_attribute({
        server_root : server_root,
        mid : model._id,
        aid : "input-structure-correlation",
        array : 0,
        attribute : 0,
        success : function(result)
        {
          x_loadings = result;
          setup_widgets();
        },
        error : artifact_missing
      });

      // Load the y_loadings artifact.
      get_model_array_attribute({
        server_root : server_root,
        mid : model._id,
        aid : "output-structure-correlation",
        array : 0,
        attribute : 0,
        success : function(result)
        {
          y_loadings = result;
          setup_widgets();
        },
        error : artifact_missing
      });

      // Load the r^2 statistics artifact.
      get_model_array_attribute({
        server_root : server_root,
        mid : model._id,
        aid : "cca-statistics",
        array : 0,
        attribute : 0,
        success : function(result)
        {
          r2 = result;
          setup_widgets();
        },
        error : artifact_missing
      });

      // Load the Wilks statistics artifact.
      get_model_array_attribute({
        server_root : server_root,
        mid : model._id,
        aid : "cca-statistics",
        array : 0,
        attribute : 1,
        success : function(result)
        {
          wilks = result;
          setup_widgets();
        },
        error : artifact_missing
      });

      // Load the canonical-indices artifact.
      get_model_array_attribute({
        server_root : server_root,
        mid : model._id,
        aid : "canonical-indices",
        array : 0,
        attribute : 0,
        success : function(result)
        {
          indices = result;
          setup_widgets();
        },
        error : function()
        {
          generate_indices = true;
          setup_indices();
        }
      });

      // Load the canonical-variables artifacts.
      get_model_array_attribute({
        server_root : server_root,
        mid : model._id,
        aid : "canonical-variables",
        array : 0,
        attribute : 0,
        success : function(result)
        {
          x = result;
          setup_widgets();
        },
        error : artifact_missing
      });

      get_model_array_attribute({
        server_root : server_root,
        mid : model._id,
        aid : "canonical-variables",
        array : 0,
        attribute : 1,
        success : function(result)
        {
          y = result;
          setup_widgets();
        },
        error : artifact_missing
      });

      // Load data table metadata.
      $.ajax({
        url : server_root + "models/" + model._id + "/tables/data-table/arrays/0/metadata?index=Index",
        contentType : "application/json",
        success: function(metadata)
        {
          table_metadata = metadata;

          setup_indices();
          setup_v();
          setup_widgets();
        },
        error: artifact_missing
      });

      // Retrieve bookmarked state information ...
      bookmarker.get_state(function(state)
      {
        bookmark = state;
        setup_colorswitcher();
        setup_v();
        setup_widgets();
      });
    }
  }

  function show_status_messages()
  {
    $("#status-messages").dialog(
    {
      autoOpen: true,
      width: 500,
      height: 300,
      modal: false,
      buttons:
      {
        OK: function()
        {
          $("#status-messages").dialog("close");
        }
      }
    });
  }

  function artifact_missing()
  {
    $(".load-status").css("display", "none");

    $("#status-messages").empty().html(
      "<div class='error-heading'>Oops, there was a problem retrieving data from the model.</div>" +
      "<div class='error-description'>This probably means that there was a problem building the model.  Here's the last thing that was going on with it:</div>" +
      "<pre>" + model["message"] + "</pre>");

    show_status_messages();
  }

  //////////////////////////////////////////////////////////////////////////////////////////
  // Setup page layout and forms.
  //////////////////////////////////////////////////////////////////////////////////////////

/*
  // Setup the Rerun Model form ...
  rerun_cca_model = null;
  $("#rerun-cca-form").dialog(
  {
    autoOpen: false,
    width: 700,
    height: 700,
    modal: true,
    open : function()
    {
      $("#rerun-cca-basics").css("display", "block");
      $("#rerun-cca-parameters").css("display", "none");
      $("#rerun-cca-running").css("display", "none");
      $(".ui-dialog-buttonpane button:contains('Previous')").button("disable");
      $(".ui-dialog-buttonpane button:contains('Next')").button("enable");
      $(".ui-dialog-buttonpane button:contains('Run')").button("disable");
    },
    close : function()
    {
      clearTimeout(window.modelGenerationTimeout);
      if(rerun_cca_model!=null) {
        $.ajax(
        {
          type : "DELETE",
          url : server_root + "models/" + rerun_cca_model,
          success : function(details)
          {
            console.log("successfuly deleted unfinished model");
          },
          error : function(request, status, reason_phrase)
          {
            console.log("problems deleting unfinished model");
          }
        });
      }
      rerun_cca_model = null;
    },
    buttons:
    {
      "Previous" : function(){
        $("#rerun-cca-basics").css("display", "block");
        $("#rerun-cca-parameters").css("display", "none");
        $(".ui-dialog-buttonpane button:contains('Next')").button("enable");
        $(".ui-dialog-buttonpane button:contains('Run')").button("disable");
        $(".ui-dialog-buttonpane button:contains('Previous')").button("disable");
      },
      "Next" : function(){
        $(".ui-dialog-buttonpane button:contains('Next')").button("disable");
        $(".ui-dialog-buttonpane button:contains('Run')").button("enable");
        $(".ui-dialog-buttonpane button:contains('Previous')").button("enable");
        $.ajax(
        {
          type : "POST",
          url : server_root + "projects/" + model.project + "/models",
          contentType : "application/json",
          data: $.toJSON(
          {
            "model-type" : "cca",
            "name" : $("#rerun-cca-name").val(),
            "marking" : "{{marking}}",
            "description" : $("#rerun-cca-description").val()
          }),
          processData: false,
          success: function(result)
          {
            rerun_cca_model = result["id"];
            $.ajax(
            {
              type : "PUT",
              url : server_root + "models/" + rerun_cca_model + "/inputs",
              data : $.toJSON(
              {
                "sid" : model._id,
              }),
              processData: false,
              contentType: "application/json",
              success: function(result)
              {
                $.ajax(
                {
                  type : "GET",
                  url : server_root + "models/" + rerun_cca_model + "/tables/data-table/arrays/0/metadata",
                  success : function(table)
                  {
                    function deselect_companion(companion)
                    {
                      return function()
                      {
                        companion.removeAttr("checked");
                      }
                    }
                    $("#rerun-cca-variables tbody").empty();
                    $.each(table["column-names"], function(index, column)
                    {
                      var row = $("<tr>")
                        .addClass(function(){
                          if( (table["column-types"][index] == "string") || (table["column-min"][index] == table["column-max"][index]) )
                            return "disabled ui-state-default";
                        })
                        .appendTo($("#rerun-cca-variables tbody"))
                        ;
                      $("<td>").text(column).appendTo(row);

                      if(table["column-types"][index] == "string")
                      {
                        $("<td colspan='2'><span class='ui-icon ui-icon-info'></span>Cannot analyze non-numeric data.</td>").appendTo(row);
                      }
                      else if(table["column-min"][index] == table["column-max"][index])
                      {
                        $("<td colspan='2'><span class='ui-icon ui-icon-info'></span>Cannot analyze constant data.</td>").appendTo(row);
                      }
                      else
                      {
                        var input = $("<input type='checkbox' name='inputs' class='rerun-cca-input-variable' title='Treat variable as an input for analysis.'>").val(index).appendTo($("<td>").appendTo(row));
                        var output = $("<input type='checkbox' name='outputs' class='rerun-cca-output-variable' title='Treat variable as an output for analysis.'>").val(index).appendTo($("<td>").appendTo(row));

                        if(jQuery.inArray(index, input_columns) != -1)
                          input.attr("checked", "checked");
                        if(jQuery.inArray(index, output_columns) != -1)
                          output.attr("checked", "checked");

                        input.click(deselect_companion(output));
                        output.click(deselect_companion(input));
                      }
                    });
                    if(scale_inputs)
                      $("#rerun-cca-scale-inputs").attr("checked", "checked");
                    else
                      $("#rerun-cca-scale-inputs").removeAttr("checked");
                    $("#rerun-cca-basics").css("display", "none");
                    $("#rerun-cca-parameters").css("display", "block");
                  },
                  error: function(request, status, reason_phrase)
                  {
                    window.alert("Error creating model: " + reason_phrase);
                  }
                });
              },
              error: function(request, status, reason_phrase)
              {
                window.alert("Error creating model: " + reason_phrase);
              }
            });
          },
          error: function(request, status, reason_phrase)
          {
            window.alert("Error creating model: " + reason_phrase);
          }
        });
      },
      "Run" : function(){
        function store_parameter(name, value)
        {
          $.ajax(
          {
            async : false,
            type : "PUT",
            url : server_root + "models/" + rerun_cca_model + "/parameters/" + name,
            contentType : "application/json",
            data: $.toJSON(
            {
              input : true,
              value : value,
            }),
            processData : false,
            error: function(request, status, reason_phrase)
            {
              window.alert("Error setting model parameter: " + reason_phrase);
            }
          });
        }

        var selected_input_columns = [];
        $(".rerun-cca-input-variable:checked").each(function(index, element) { selected_input_columns.push(Number($(element).val())); });
        if(selected_input_columns.length < 1)
        {
          window.alert("You must select at least one input column.");
          return;
        }

        var selected_output_columns = [];
        $(".rerun-cca-output-variable:checked").each(function(index, element) { selected_output_columns.push(Number($(element).val())); });
        if(selected_output_columns.length < 1)
        {
          window.alert("You must select at least one output column.");
          return;
        }

        store_parameter("input-columns", selected_input_columns);
        store_parameter("output-columns", selected_output_columns);
        store_parameter("scale-inputs", $("#rerun-cca-scale-inputs").attr("checked") == "checked" ? true : false);

        $.ajax(
        {
          type : "POST",
          url : server_root + "models/" + rerun_cca_model + "/finish",
          success: function(result)
          {
            var mid = rerun_cca_model;
            rerun_cca_model = null;
            $(".ui-dialog-buttonpane button:contains('Next')").button("disable");
            $(".ui-dialog-buttonpane button:contains('Run')").button("disable");
            $(".ui-dialog-buttonpane button:contains('Previous')").button("disable");
            $(".ui-dialog-buttonpane button:contains('Cancel')").button({ label: "Close" });

            window.modelGenerationTimeout = setTimeout(function(){
              get_model_status(mid, process_model_status);
            }, 1000);
          },
          error: function(request, status, reason_phrase)
          {
            window.alert("Error creating model: " + reason_phrase);
          }
        });
      },
      Cancel : function(){
        $(this).dialog("close");
      },
    },
  });

  function process_model_status(results) {
    if(results.finished === null) {
      $("#rerun-cca-parameters").css("display", "none");
      $("#rerun-cca-running").css("display", "block");
      var modelPie = $("#model-progress .modelPie");
      modelPie.knob({
            'min':0,
            'max':1,
            'readOnly':true,
            'displayInput':false,
            'fgColor':'#4D720C',
            'bgColor':'#D7D7D6',
            'width':200,
            'height':200,
            'thickness':0.35,
            'step':0.01,
          });
      modelPie.val(results["progress"]).trigger('change');
      window.modelGenerationTimeout = setTimeout(function(){
        get_model_status(results._id, process_model_status);
      }, 1000);
    }
    else {
      window.location = server_root + "models/" + results._id;
    }
  }

  function get_model_status(mid, callback)
  {
    $.ajax(
    {
      dataType : "json",
      type : "GET",
      cache : false, // Don't cache this request; otherwise, the browser will display the JSON if the user leaves this page then returns.
      url : server_root + "models/" + mid,
      success : function(results)
      {
        callback(results);
      },
      error : function(request, status, reason_phrase)
      {
        callback(reason_phrase);
      },
    });
  }

  $("#rerun-cca-all-inputs-on").button().click(function()
  {
    $(".rerun-cca-input-variable").attr("checked", "checked");
    $(".rerun-cca-output-variable").removeAttr("checked");
  });
  $("#rerun-cca-all-inputs-off").button().click(function()
  {
    $(".rerun-cca-input-variable").removeAttr("checked");
  });
  $("#rerun-cca-all-outputs-on").button().click(function()
  {
    $(".rerun-cca-output-variable").attr("checked", "checked");
    $(".rerun-cca-input-variable").removeAttr("checked");
  });
  $("#rerun-cca-all-outputs-off").button().click(function()
  {
    $(".rerun-cca-output-variable").removeAttr("checked");
  });

  $("#rerun-cca-button").button().click(function()
  {
    $("#rerun-cca-form").dialog("open");
  });
*/

  // Layout resizable panels ...
  $("#cca-model").layout(
  {
    applyDefaultStyles: true,
    west:
    {
      size: $("#cca-model").width() / 2,
      resizeWhileDragging: false,
      onresize: function() { $("#barplot-table").barplot("resize_canvas"); },
    },
    center:
    {
      resizeWhileDragging: false,
      onresize: function() { $("#scatterplot").scatterplot("option", {width: $("#scatterplot-pane").width(), height: $("#scatterplot-pane").height()}); },
    },
    east:
    {
      size: 130,
      resizeWhileDragging: false,
      onresize: function() { $("#legend").legend("option", {width: $("#legend-pane").width(), height: $("#legend-pane").height()}); },
    },
    south:
    {
      size: $("body").height() / 2,
      resizeWhileDragging: false,
      onresize: function()
      {
        $("#table").css("height", $("#table-pane").height());
        $("#table").table("resize_canvas");
      }
    },
  });

  //////////////////////////////////////////////////////////////////////////////////////////
  // Setup the rest of the UI as data is received.
  //////////////////////////////////////////////////////////////////////////////////////////

  function setup_indices()
  {
    if(generate_indices && table_metadata)
    {
      var count = table_metadata["row-count"];
      indices = new Int32Array(count);
      for(var i = 0; i != count; ++i)
        indices[i] = i;
      setup_widgets();
    }
  }

  function setup_v()
  {
    if(bookmark && table_metadata)
    {
      var index = table_metadata["column-count"] - 1;
      if("variable-selection" in bookmark)
        index = bookmark["variable-selection"];

      if(index == table_metadata["column-count"] - 1)
      {
        var count = table_metadata["row-count"];
        v = new Float64Array(count);
        for(var i = 0; i != count; ++i)
          v[i] = i;
        setup_widgets();
      }
      else
      {
        get_model_array_attribute({
          server_root : server_root,
          mid : model._id,
          aid : "data-table",
          array : 0,
          attribute : index,
          success : function(result)
          {
            v = result;
            setup_widgets();
          },
          error : artifact_missing
        });
      }
    }
  }

  function setup_colorswitcher()
  {
    var colormap = bookmark["colormap"] !== undefined ? bookmark["colormap"] : "night";

    $("#color-switcher").colorswitcher({colormap:colormap});
    $("#color-switcher").bind("colormap-changed", function(event, colormap)
    {
      selected_colormap_changed(colormap);
    });
  }

  function setup_widgets()
  {
    // Setup the legend ...
    if(!legend_ready && bookmark && table_metadata)
    {
      legend_ready = true;

      $("#legend-pane .load-status").css("display", "none");

      var colormap = bookmark["colormap"] !== undefined ? bookmark["colormap"] : "night";

      $("#legend-pane").css("background", $("#color-switcher").colorswitcher("get_background", colormap).toString());

      var v_index = table_metadata["column-count"] - 1;
      if("variable-selection" in bookmark)
        v_index = bookmark["variable-selection"];

      $("#legend").legend({
        width: $("#legend-pane").width(),
        height: $("#legend-pane").height(),
        gradient: $("#color-switcher").colorswitcher("get_gradient_data", colormap),
        label: table_metadata["column-names"][v_index],
        min: table_metadata["column-min"][v_index],
        max: table_metadata["column-max"][v_index],
      });

      // Changing the color map updates the legend ...
      $("#color-switcher").bind("colormap-changed", function(event, colormap)
      {
        $("#legend-pane").css("background", $("#color-switcher").colorswitcher("get_background", colormap).toString());
        $("#legend").legend("option", {gradient: $("#color-switcher").colorswitcher("get_gradient_data", colormap)});
      });

      // Changing the table variable selection updates the legend ...
      $("#table").bind("variable-selection-changed", function(event, selection)
      {
        $("#legend").legend("option", {
          min: table_metadata["column-min"][selection[0]],
          max: table_metadata["column-max"][selection[0]],
          label: table_metadata["column-names"][selection[0]],
        });
      });

      // Changing the barplot variable updates the legend ...
      $("#barplot-table").bind("variable-changed", function(event, v_index)
      {
        $("#legend").legend("option", {
          min: table_metadata["column-min"][v_index],
          max: table_metadata["column-max"][v_index],
          label: table_metadata["column-names"][v_index],
        });
      });

    }

    // Setup the barplot ...
    if(!barplot_ready && bookmark && table_metadata && r2 && wilks && x_loadings && y_loadings)
    {
      barplot_ready = true;

      $("#barplot-pane .load-status").css("display", "none");

      var component = bookmark["cca-component"] !== undefined ? bookmark["cca-component"] : 0;

      $("#barplot-table").barplot({
        metadata: table_metadata,
        inputs: input_columns,
        outputs: output_columns,
        r2: r2,
        wilks: wilks,
        x_loadings: x_loadings,
        y_loadings: y_loadings,
        component: component,
      });

      if("variable-selection" in bookmark)
      {
        $("#barplot-table").barplot("option", "variable", bookmark["variable-selection"]);
      }

      $("#barplot-table").bind("component-changed", function(event, component)
      {
        selected_component_changed(component);
      });

      $("#barplot-table").bind("component-sort-changed", function(event, component, order)
      {
        component_sort_changed(component, order);
      });

      $("#barplot-table").bind("variable-changed", function(event, variable)
      {
        selected_variable_changed(variable);
      });

      if("sort-cca-component" in bookmark && "sort-direction-cca-component" in bookmark)
      {
        $("#barplot-table").barplot("option",
        {
          "sort": [bookmark["sort-cca-component"], bookmark["sort-direction-cca-component"]]
        });
      }
    }

    // Setup the scatterplot ...
    if(!scatterplot_ready && bookmark && indices && x && y && v)
    {
      scatterplot_ready = true;

      $("#scatterplot-pane .load-status").css("display", "none");

      var component = bookmark["cca-component"] !== undefined ? bookmark["cca-component"] : 0;
      var colormap = bookmark["colormap"] !== undefined ? bookmark["colormap"] : "night";
      var selection = bookmark["simulation-selection"] !== undefined ? bookmark["simulation-selection"] : [];

      $("#scatterplot-pane").css("background", $("#color-switcher").colorswitcher("get_background", colormap).toString());

      $("#scatterplot").scatterplot({
        indices: indices,
        x: x[component],
        y: y[component],
        v: v,
        width: $("#scatterplot-pane").width(),
        height: $("#scatterplot-pane").height(),
        color: $("#color-switcher").colorswitcher("get_color_scale", colormap),
        selection: selection,
        });

      $("#scatterplot").bind("selection-changed", function(event, selection)
      {
        selected_simulations_changed(selection);
      });

      // Changing the color map updates the scatterplot ...
      $("#color-switcher").bind("colormap-changed", function(event, colormap)
      {
        $("#scatterplot-pane").css("background", $("#color-switcher").colorswitcher("get_background", colormap).toString());
        $("#scatterplot").scatterplot("option", {color: $("#color-switcher").colorswitcher("get_color_scale", colormap)});
      });

      // Changing the barplot component updates the scatterplot ...
      $("#barplot-table").bind("component-changed", function(event, component)
      {
        $("#scatterplot").scatterplot("option", {x : x[component], y : y[component]});
      });

      // Changing the barplot variable updates the scatterplot ...
      $("#barplot-table").bind("variable-changed", function(event, variable)
      {
        update_scatterplot_value(variable);
      });
    }

    // Setup the table ...
    if(!table_ready && bookmark && table_metadata)
    {
      table_ready = true;

      $("#table-pane .load-status").css("display", "none");

      var other_columns = [];
      for(var i = 0; i != table_metadata["column-count"] - 1; ++i)
      {
        if($.inArray(i, input_columns) == -1 && $.inArray(i, output_columns) == -1)
          other_columns.push(i);
      }

      var table_options =
      {
        "server-root" : server_root,
        mid : model._id,
        aid : "data-table",
        metadata : table_metadata,
        inputs : input_columns,
        outputs : output_columns,
        others : other_columns,
      };

      var colormap = bookmark["colormap"] !== undefined ? bookmark["colormap"] : "night";
      table_options.colormap = $("#color-switcher").colorswitcher("get_color_scale", colormap);

      if("sort-variable" in bookmark && "sort-order" in bookmark)
      {
        table_options["sort-variable"] = bookmark["sort-variable"];
        table_options["sort-order"] = bookmark["sort-order"];
      }

      if("variable-selection" in bookmark)
      {
        table_options["variable-selection"] = [bookmark["variable-selection"]];
      }
      else
      {
        table_options["variable-selection"] = [table_metadata["column-count"] - 1];
      }

      if(bookmark["simulation-selection"] !== undefined)
        table_options["row-selection"] = bookmark["simulation-selection"];

      $("#table").table(table_options);

      // Log changes to the table sort order ...
      $("#table").bind("variable-sort-changed", function(event, variable, order)
      {
        variable_sort_changed(variable, order);
      });

      // Log changes to the table variable selection ...
      $("#table").bind("variable-selection-changed", function(event, selection)
      {
        selected_variable_changed(selection[0]);
      });

      // Log changes to the table row selection ...
      $("#table").bind("row-selection-changed", function(event, selection)
      {
        // The table selection is an array buffer which can't be
        // serialized as JSON, so convert it to an array.
        var temp = [];
        for(var i = 0; i != selection.length; ++i)
          temp.push(selection[i]);
        selected_simulations_changed(temp);
      });

      // Changing the colormap updates the table ...
      $("#color-switcher").bind("colormap-changed", function(event, colormap)
      {
        $("#table").table("option", "colormap", $("#color-switcher").colorswitcher("get_color_scale", colormap));
      });

      // Changing the barplot variable updates the table ...
      $("#barplot-table").bind("variable-changed", function(event, variable)
      {
        $("#table").table("option", "variable-selection", [variable]);
      });

      // Changing the table variable updates the barplot ...
      $("#table").bind("variable-selection-changed", function(event, selection)
      {
        $("#barplot-table").barplot("option", "variable", selection[0]);
      });

      // Changing the table variable updates the scatterplot ...
      $("#table").bind("variable-selection-changed", function(event, selection)
      {
        update_scatterplot_value(selection[0]);
      });

      // Changing the scatterplot selection updates the table row selection ..
      $("#scatterplot").bind("selection-changed", function(event, selection)
      {
        $("#table").table("option", "row-selection", selection);
      });

      // Changing the table row selection updates the scatterplot ...
      $("#table").bind("row-selection-changed", function(event, selection)
      {
        // The table selection is an array buffer, so convert it to an array.
        var temp = [];
        for(var i = 0; i != selection.length; ++i)
          temp.push(selection[i]);

        $("#scatterplot").scatterplot("option", "selection",  temp);
      });
    }
  }

  //////////////////////////////////////////////////////////////////////////////////////////
  // Event handlers.
  //////////////////////////////////////////////////////////////////////////////////////////

  function selected_colormap_changed(colormap)
  {
    $.ajax(
    {
      type : "POST",
      url : server_root + "events/models/" + model._id + "/select/colormap/" + colormap
    });
    bookmarker.updateState({"colormap" : colormap});
  }

  function selected_component_changed(component)
  {
    $.ajax(
    {
      type : "POST",
      url : server_root + "events/models/" + model._id + "/select/component/" + component
    });
    bookmarker.updateState({"cca-component" : component});
  }

  function component_sort_changed(component, order)
  {
    $.ajax(
    {
      type : "POST",
      url : server_root + "events/models/" + model._id + "/sort/component/" + component + "/" + order
    });
    bookmarker.updateState({"sort-cca-component" : component, "sort-direction-cca-component" : order});
  }

  function selected_variable_changed(variable)
  {
    $.ajax(
    {
      type : "POST",
      url : server_root + "events/models/" + model._id + "/select/variable/" + variable
    });
    bookmarker.updateState({"variable-selection" : variable});
  }

  function variable_sort_changed(variable, order)
  {
    $.ajax(
    {
      type : "POST",
      url : server_root + "events/models/" + model._id + "/select/sort-order/" + variable + "/" + order
    });
    bookmarker.updateState( {"sort-variable" : variable, "sort-order" : order} );
  }

  function selected_simulations_changed(selection)
  {
    // Logging every selected item is too slow, so just log the count instead.
    $.ajax(
    {
      type : "POST",
      url : server_root + "events/models/" + model._id + "/select/simulation/count/" + selection.length
    });
    bookmarker.updateState( {"simulation-selection" : selection} );
  }

  function update_scatterplot_value(attribute)
  {
    if(attribute == table_metadata["column-count"] - 1)
    {
      var count = v.length;
      for(var i = 0; i != count; ++i)
        v[i] = i;
      $("#scatterplot").scatterplot("option", {v : v});
    }
    else
    {
      get_model_array_attribute({
        server_root : server_root,
        mid : model._id,
        aid : "data-table",
        array : 0,
        attribute : attribute,
        success : function(result)
        {
          v = result;
          $("#scatterplot").scatterplot("option", {v : v});
        },
        error : artifact_missing
      });
    }
  }

});
