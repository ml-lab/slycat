/*
Copyright 2013, Sandia Corporation. Under the terms of Contract
DE-AC04-94AL85000 with Sandia Corporation, the U.S. Government retains certain
rights in this software.
*/

$.widget("slycat.colorswitcher",
{
  options:
  {
    colormap : "night",
  },

  _create: function()
  {
    var self = this;

    this.color_maps =
    {
      "night":
      {
        "label": "Night",
        "background": d3.rgb("#333333"),
        "colors":
        [
          d3.rgb( 59,  76, 192),
          d3.rgb( 68,  90, 204),
          d3.rgb( 77, 104, 215),
          d3.rgb( 87, 117, 225),
          d3.rgb( 98, 130, 234),
          d3.rgb(108, 142, 241),
          d3.rgb(119, 154, 247),
          d3.rgb(130, 165, 251),
          d3.rgb(141, 176, 254),
          d3.rgb(152, 185, 255),
          d3.rgb(163, 194, 255),
          d3.rgb(174, 201, 253),
          d3.rgb(184, 208, 249),
          d3.rgb(194, 213, 244),
          d3.rgb(204, 217, 238),
          d3.rgb(213, 219, 230),
          d3.rgb(221, 221, 221),
          d3.rgb(229, 216, 209),
          d3.rgb(236, 211, 197),
          d3.rgb(241, 204, 185),
          d3.rgb(245, 196, 173),
          d3.rgb(247, 187, 160),
          d3.rgb(247, 177, 148),
          d3.rgb(247, 166, 135),
          d3.rgb(244, 154, 123),
          d3.rgb(241, 141, 111),
          d3.rgb(236, 127,  99),
          d3.rgb(229, 112,  88),
          d3.rgb(222,  96,  77),
          d3.rgb(213,  80,  66),
          d3.rgb(203,  62,  56),
          d3.rgb(192,  40,  47),
          d3.rgb(180,   4,  38),
        ]
      },
    "day":
      {
        "label": "Day",
        "background": d3.rgb(255, 255, 255),
        "colors":
        [
          d3.rgb(100, 108, 234),
          d3.rgb(115, 118, 240),
          d3.rgb(128, 128, 244),
          d3.rgb(140, 138, 248),
          d3.rgb(151, 147, 250),
          d3.rgb(161, 155, 251),
          d3.rgb(169, 163, 251),
          d3.rgb(177, 170, 250),
          d3.rgb(184, 177, 248),
          d3.rgb(189, 182, 245),
          d3.rgb(193, 187, 241),
          d3.rgb(197, 191, 236),
          d3.rgb(199, 194, 230),
          d3.rgb(200, 196, 224),
          d3.rgb(201, 198, 216),
          d3.rgb(200, 199, 208),
          d3.rgb(198, 198, 198),
          d3.rgb(210, 197, 195),
          d3.rgb(220, 194, 192),
          d3.rgb(229, 191, 187),
          d3.rgb(236, 186, 181),
          d3.rgb(243, 181, 175),
          d3.rgb(248, 175, 168),
          d3.rgb(251, 168, 160),
          d3.rgb(254, 159, 152),
          d3.rgb(255, 150, 143),
          d3.rgb(255, 140, 133),
          d3.rgb(253, 129, 123),
          d3.rgb(250, 117, 112),
          d3.rgb(246, 105, 101),
          d3.rgb(240,  91,  90),
          d3.rgb(233,  75,  78),
          d3.rgb(225,  57,  66),
        ]
      },
    "rainbow":
      {
        "label": "Rainbow",
        "background": d3.rgb(128, 128, 128),
        "colors":
        [
          d3.rgb(255, 0, 0),
          d3.rgb(255, 255, 0),
          d3.rgb(0, 255, 0),
          d3.rgb(0, 255, 255),
          d3.rgb(0, 0, 255),
        ]
      },
    };

    this.container = $("<div>")
      .appendTo(this.element)
      .append('<span class="label">Colors: </span>')
      ;
    $.each(this.color_maps, function(key, value)
    {
      var button = $("<span>")
        .addClass("color")
        .toggleClass("selected", key == self.options.colormap)
        .appendTo(self.container)
        .attr("data-colormap", key)
        .html(value.label)
        .click(function()
        {
          if($(this).hasClass("selected"))
            return;

          self.options.colormap = this.getAttribute("data-colormap");
          self.container.find(".color").removeClass("selected");
          $(this).addClass("selected");

          self.element.trigger("colormap-changed", [self.options.colormap]);
        })
        ;
    });
  },

  _setOption: function(key, value)
  {
    console.log("slycat.colorswitcher._setOption()", key, value);
    this.options[key] = value;

    if(key == "colormap")
    {
      this.container.find(".color").removeClass("selected");
      this.container.find("[data-colormap='" + this.options.colormap + "']").addClass("selected");
    }
  },

  // Return a d3 rgb object with the suggested background color for the given color map.
  get_background: function(name)
  {
    return this.color_maps[name].background;
  },

  // Return a d3 linear color scale with the current color map for the domain [0, 1].
  // Callers should modify the domain to suit their own needs.  Note that a color
  // map may be polylinear, i.e. require more than two values for the domain.
  get_color_map: function(name, min, max)
  {
    if(min === undefined)
      min = 0.0;
    if(max === undefined)
      max = 1.0;
    var domain = []
    var domain_scale = d3.scale.linear().domain([0, this.color_maps[name].colors.length]).range([min, max]);
    for(var i in this.color_maps[name].colors)
      domain.push(domain_scale(i));
    return d3.scale.linear().domain(domain).range(this.color_maps[name].colors);
  },

  setUpColorMapsForAllColumns: function(name, columns)
  {
    for(var j = 0; j != columns.length; ++j)
    {
      columns[j].colorMap = this.get_color_map(name, columns[j].columnMin, columns[j].columnMax);
    }
  }
});