def register_slycat_plugin(context):
  """Called during startup when the plugin is loaded."""
  import cherrypy
  import datetime
  import json
  import numpy
  import os
  import re
  import slycat.web.server

  def media_columns(database, model, command, **kwargs):
    """Identify columns in the input data that contain media URIs (image or video)."""
    expression = re.compile("file://")
    search = numpy.vectorize(lambda x:bool(expression.search(x)))

    columns = []
    metadata = slycat.web.server.get_model_arrayset_metadata(database, model, "data-table", arrays=[0])["arrays"][0]
    for index, attribute in enumerate(metadata["attributes"]):
      if attribute["type"] != "string":
        continue
      column = next(slycat.web.server.get_model_arrayset_data(database, model, "data-table", (0, index, numpy.index_exp[...])))
      if not numpy.any(search(column)):
        continue
      columns.append(index)

    cherrypy.response.headers["content-type"] = "application/json"
    return json.dumps(columns)

  def finish(database, model):
    """Called to finish the model.  This function must return immediately, so any real work would be done in a separate thread."""
    slycat.web.server.update_model(database, model, state="finished", result="succeeded", finished=datetime.datetime.utcnow().isoformat(), progress=1.0, message="")

  def html(database, model):
    """Add the HTML representation of the model to the context object."""
    import json
    import pystache

    context = dict()
    context["formatted-model"] = json.dumps(model, indent=2, sort_keys=True)
    context["_id"] = model["_id"];
    context["name"] = model["name"];
    context["full-project"] = database.get("project", model["project"]);
    return pystache.render(open(os.path.join(os.path.dirname(__file__), "ui.html"), "r").read(), context)

  # Register our new model type
  context.register_model("parameter-image", finish, html)

    # Register JS
  javascripts = [
    "jquery-ui-1.10.4.custom.min.js",
    "jquery.layout-latest.min.js",
    "d3.min.js",
    #"jquery.mousewheel.js",
    "jquery.scrollintoview.min.js",
    "jquery.event.drag-2.2.js",
    "slick.core.js",
    "slick.grid.js",
    "slick.rowselectionmodel.js",
    "slick.headerbuttons.js",
    "slick.autotooltips.js",
    "slick.slycateditors.js",
    "chunker.js",
    "color-switcher.js",
    "note-display.js",
    # "parameter-controls.js",
    # "parameter-image-table.js",
    # "parameter-image-scatterplot.js",
    # "ui.js",
    #For development and debugging, comment out js here and load it dynamically inside model.
  ]
  context.register_model_bundle("parameter-image", "text/javascript", [
    os.path.join(os.path.join(os.path.dirname(__file__), "js"), js) for js in javascripts
    ])

  # Register CSS
  stylesheets = [
    "slick.grid.css",
    "slick-default-theme.css",
    "slick.headerbuttons.css",
    "slick-slycat-theme.css",
    #"ui.css",
    "slycat-additions.css",
    #For development and debugging, comment out css here and load it dynamically inside model.
  ]
  context.register_model_bundle("parameter-image", "text/css", [
    os.path.join(os.path.dirname(__file__), "css", css) for css in stylesheets
    ])

  # Register images and other resources
  images = [
    "x-gray.png",
    "x-light.png",
    "y-gray.png",
    "y-light.png",
    "sort-asc-light.png",
    "sort-asc-gray.png",
    "sort-desc-light.png",
    "sort-desc-gray.png",
    "image-gray.png",
    "image-light.png",
    "stripe1.png",
    "stripe2.png",
    "pin.png",
    "resize.png",
    "close.png",
    "ajax-loader.gif",
  ]
  for image in images:
    context.register_model_resource("parameter-image", image, os.path.join(os.path.dirname(__file__), "img", image))

  devs = [
    "js/parameter-controls.js",
    "js/parameter-image-table.js",
    "js/parameter-image-scatterplot.js",
    "js/ui.js",
    "css/ui.css",
  ]
  for dev in devs:
    context.register_model_resource("parameter-image", dev, os.path.join(os.path.dirname(__file__), dev))

  # Register a custom command for use by the wizard.
  context.register_model_command("parameter-image", "media-columns", media_columns)

  # Register custom wizards for creating PI models.
  context.register_wizard("parameter-image", "New Remote Parameter Image Model", require={"action":"create", "context":"project"})
  context.register_wizard_resource("parameter-image", "ui.js", os.path.join(os.path.dirname(__file__), "js/wizard-ui.js"))
  context.register_wizard_resource("parameter-image", "ui.html", os.path.join(os.path.dirname(__file__), "wizard-ui.html"))
