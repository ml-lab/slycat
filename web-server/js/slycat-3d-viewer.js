define('slycat-3d-viewer', ['slycat-server-root', 'knockout', 'URI'], function(server_root, ko, URI) {

  /**
   * A Knockout component to render STL files in slycat, using the Three.js
   * library.
   *
   * Dependencies:
   *   three.min.js
   *   TackballControls.js
   *   STLLoader.js
   *
   * @param {String} mid Model ID. This is an optional parameter.
   * @param {String} aid Artifact ID.
   * @param {String} cid Container ID. This is the CSS ID of the container for the STL viewer.
   */
  ko.components.register('slycat-3d-viewer', {
    viewModel: function(params) {

      if (!Detector.webgl) Detector.addGetWebGLMessage();

      var mid = params.mid || URI(window.location).segment(-1);
      var aid = params.aid;
      var cid = params.cid;

      var vid = generateViewerId(cid);
      adjustViewerHeight(vid);

      var viewer = document.getElementById(vid);
      var width = viewer.offsetWidth;
      var height = viewer.offsetHeight;

      var settings = null;
      var defaultMaterialColor = '#337AB7';
      var defaultLightColor = '#FFFFFF';
      var defaultAmbientLightColor = '#F2F2F2';
      var defaultBackgroundColor = '#F2F2F2';

      var renderer = null;
      var camera = null;
      var mouse = null;
      var controls = null;
      var scene = null;
      var ambient = null;
      var mesh = null;
      var material = null;
      var animation = { id: null };
      var lightOne = null;
      var lightTwo = null;

      new THREE.STLLoader().load(mid + '/files/' + aid, function(geometry) {

        geometry.computeBoundingSphere();
        geometry.computeBoundingBox();
        var gbs = geometry.boundingSphere;
        var gbb = geometry.boundingBox;

        /**
         * THREE.PerspectiveCamera(
         *     field of view,
         *     aspect ratio,
         *     near clippling pane,
         *     far clipping pane )
         */
        camera = new THREE.PerspectiveCamera(75, width/height, 0.1, 1000);
        camera.position.x = gbb.max.x;
        camera.position.y = gbb.max.y;
        camera.position.z = gbb.max.z + (gbs.radius*4);

        mouse = new THREE.Vector2();
        controls = new THREE.TrackballControls(camera, viewer);
        controls.rotateSpeed = 2;
        controls.zoomSpeed = 1.5;
        controls.panSpeed = 1;
        controls.noZoom = false;
        controls.noPan = false;
        controls.staticMoving = true;
        controls.dynamicDampingFactor = 0.3;


        scene = new THREE.Scene();
        ambient = new THREE.AmbientLight(defaultAmbientLightColor);
        scene.add(ambient);

        /** light 1 is to the right and front of the object */
        lightOne = new THREE.PointLight(defaultLightColor);
        lightOne.position.set(gbb.max.x + (gbs.radius*6), gbb.max.y + (gbs.radius*6), gbb.max.z + (gbs.radius*6));
        scene.add(lightOne);

        /** light 2 is to the left and back of the object */
        lightTwo = new THREE.PointLight(defaultLightColor);
        lightTwo.position.set(gbb.max.x - (gbs.radius*6), gbb.max.y - (gbs.radius*6), gbb.max.z - (gbs.radius*6));
        scene.add(lightTwo);

        material = new THREE.MeshLambertMaterial({ color: defaultMaterialColor });

        mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(gbs.center.x, gbs.center.y, gbs.center.z);

        scene.add(mesh);
        camera.lookAt(mesh.position);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        /** Sets the background color for the scene */
        renderer.setClearColor(defaultBackgroundColor);
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(width, height);
        document.getElementById(vid).appendChild(renderer.domElement);

        renderer.domElement.addEventListener('mousemove', function(e) { onMouseMove(mouse, e); });

        /** renders the STL file... */
        renderFixed(animation, renderer, scene, camera, controls);

        /** initializes the settings popup */
        settings = new GeometrySettings({
          /** rendered settings */
          renderer: renderer,
          backgroundColor: defaultBackgroundColor,
          /** ambien light settings */
          ambientLight: ambient,
          ambientLightColor: defaultAmbientLightColor,
          /** geometry settings */
          mesh: mesh,
          materialColor: defaultMaterialColor,
          /** lighting settings */
          lightOne: lightOne,
          lightOneColor: defaultLightColor,
          lightTwo: lightTwo,
          lightTwoColor: defaultLightColor
        });
      });


      $('#' + cid + ' .slycat-3d-btn-reset').on('click', function() {
        onReset(controls, mesh);
        return false;
      });

      $('#' + cid + ' .slycat-3d-btn-rotate').on('click', function() {
        onRotation.bind(this)(animation, renderer, scene, camera, mesh, controls);
        return false;
      });

      $('#slycat-3d-modal').on('shown.bs.modal', function() {
        settings.load();
      });
    },

    template: { require: 'text!' + server_root + 'templates/slycat-3d-viewer.html' }
  });


  /**
   * Function executed on mouse events for the renderer.
   * @param  {} e event
   */
  var onMouseMove = function(mouse, e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  };

  /**
   * Generates and assigns a unique ID to the STL viewer based off its
   * container, mainly to prevent issues if viewing multiple models on the same
   * page.
   *
   * @param  {String} cid container ID
   * @return {String}     new viewer ID
   */
  var generateViewerId = function(cid) {
    var vid = 'slycat-3d-viewer-' + cid;
    $('#' + cid + ' .slycat-3d-viewer').attr('id', vid);

    return vid;
  };

  /**
   * This function is a hack because there are some issues with the heights and
   * the WebGL canvas not being rendered correctly.
   *
   * @param  {String} vid viewer ID
   */
  var adjustViewerHeight = function(vid) {
    var $stlDiv = $('#' + vid);
    var $stlParent = $stlDiv.parent();
    $stlDiv.css('height', $stlParent.height() - 48);
  };

  /**
   * Renders the geometry in a fixed position.
   * @param  {Object} animation animation object with an 'id' attribute
   * @param  {Object} renderer  reference to the rendered
   * @param  {Object} scene     reference to the scene
   * @param  {Object} camera    reference to the camera
   * @param  {Object} controls  reference to the controls
   */
  var renderFixed = function (animation, renderer, scene, camera, controls) {
    var rf = function() {
      controls.update();
      renderer.render(scene, camera);
      animation.id = requestAnimationFrame(rf);
    };

    rf();
  };

  /**
   * Renders the geometry on a rotation animation around the y axis
   * @param  {Object} animation animation object with an 'id' attribute
   * @param  {Object} renderer  reference to the rendered
   * @param  {Object} scene     reference to the scene
   * @param  {Object} camera    reference to the camera
   * @param  {Object} mesh      reference to the mesh (i.e. geometry)
   * @param  {Object} controls  reference to the controls
   */
  var renderRotate = function(animation, renderer, scene, camera, mesh, controls) {
    var rr = function() {
      controls.update();
      renderer.render(scene, camera);

      if (mesh)
        mesh.rotation.y -= 0.01;

      animation.id = requestAnimationFrame(rr);
    };

    rr();
  };

  /**
   * Function executed on click on the Rotate/Fixed button.
   * @param  {Object} animation animation object with an 'id' attribute
   * @param  {Object} renderer  reference to the rendered
   * @param  {Object} scene     reference to the scene
   * @param  {Object} camera    reference to the camera
   * @param  {Object} mesh      reference to the mesh (i.e. geometry)
   * @param  {Object} controls  reference to the controls
   */
  var onRotation = function(animation, renderer, scene, camera, mesh, controls) {
    cancelAnimationFrame(animation.id);

    if ($(this).text() === 'Rotate') {
      renderRotate(animation, renderer, scene, camera, mesh, controls);
      $(this).text('Fixed');
    } else {
      renderFixed(animation, renderer, scene, camera, controls);
      $(this).text('Rotate');
    }
  };

  /**
   * Function executed on click on the Reset button.
   * @param  {Object} controls refernce to the controls
   * @param  {Object} mesh     refernce to the mesh
   */
  var onReset = function(controls, mesh) {
    controls.reset();
    mesh.rotation.y = 0;
  };

});