Backbone.Select = (function (Backbone, _) {
  var Select = {};

  // Select.One
  // ------------------
  // A single-select mixin for Backbone.Collection, allowing a single
  // model to be selected within a collection. Selection of another
  // model within the collection causes the previous model to be
  // deselected.

  Select.One = function(){};

  _.extend(Select.One.prototype, {

    // Type indicator, undocumented, but part of the API (monitored by tests).
    // Can be queried safely by other components. Use it read-only.
    _pickyType: "Backbone.Select.One",

    // Select a model, deselecting any previously
    // selected model
    select: function(model, options){
      var reselected = model && this.selected === model ? model : undefined;

      options || (options = {});
      options._processedBy || (options._processedBy = []);
      if (options._processedBy[this._pickyCid]) { return; }

      if (!reselected) {
        this.deselect(undefined, _.omit(options, "_silentLocally"));
        this.selected = model;
      }
      options._processedBy[this._pickyCid] = this;

      if (!options._processedBy[this.selected.cid]) this.selected.select(stripLocalOptions(options));

      if (!(options.silent || options._silentLocally)) {

        if (reselected) {
          if (!options._silentReselect) this.trigger("reselect:one", model, this, stripInternalOptions(options));
        } else {
          this.trigger("select:one", model, this, stripInternalOptions(options));
        }

      }
    },

    // Deselect a model, resulting in no model
    // being selected
    deselect: function(model, options){
      options || (options = {});
      if (!this.selected){ return; }

      model = model || this.selected;
      if (this.selected !== model){ return; }

      delete this.selected;
      if (!options._skipModelCall) model.deselect(stripLocalOptions(options));
      if (!(options.silent || options._silentLocally)) this.trigger("deselect:one", model, this, stripInternalOptions(options));
    },

    close: function () {
      unregisterCollectionWithModels(this);
      this.stopListening();
    }

  });

  // Select.Many
  // -----------------
  // A multi-select mixin for Backbone.Collection, allowing a collection to
  // have multiple items selected, including `selectAll` and `deselectAll`
  // capabilities.

  Select.Many = function () {};

  _.extend(Select.Many.prototype, {

    // Type indicator, undocumented, but part of the API (monitored by tests).
    // Can be queried safely by other components. Use it read-only.
    _pickyType: "Backbone.Select.Many",

    // Select a specified model, make sure the
    // model knows it's selected, and hold on to
    // the selected model.
    select: function (model, options) {
      var prevSelected = multiSelectionToArray(this.selected),
          reselected = this.selected[model.cid] ? [ model ] : [];

      options || (options = {});
      options._processedBy || (options._processedBy = []);

      if (reselected.length && options._processedBy[this._pickyCid]) { return; }

      if (!reselected.length) {
        this.selected[model.cid] = model;
        this.selectedLength = _.size(this.selected);
      }
      options._processedBy[this._pickyCid] = this;

      if (!options._processedBy[model.cid]) model.select(stripLocalOptions(options));
      triggerMultiSelectEvents(this, prevSelected, options, reselected);
    },

    // Deselect a specified model, make sure the
    // model knows it has been deselected, and remove
    // the model from the selected list.
    deselect: function (model, options) {
      var prevSelected = multiSelectionToArray(this.selected);

      options || (options = {});
      if (!this.selected[model.cid]) { return; }

      delete this.selected[model.cid];
      this.selectedLength = _.size(this.selected);

      if (!options._skipModelCall) model.deselect(stripLocalOptions(options));
      triggerMultiSelectEvents(this, prevSelected, options);
    },

    // Select all models in this collection
    selectAll: function (options) {
      var prevSelected = multiSelectionToArray(this.selected),
          reselected = [];

      options || (options = {});
      options._processedBy || (options._processedBy = []);

      this.selectedLength = 0;
      this.each(function (model) {
        this.selectedLength++;
        if (this.selected[model.cid]) reselected.push(model);
        this.select(model, _.extend({}, options, {_silentLocally: true}));
      }, this);
      options._processedBy[this._pickyCid] = this;

      triggerMultiSelectEvents(this, prevSelected, options, reselected);
    },

    // Deselect all models in this collection
    deselectAll: function (options) {
      var prevSelected;

      if (this.selectedLength === 0) { return; }
      prevSelected = multiSelectionToArray(this.selected);

      this.each(function (model) {
        if (model.selected) this.selectedLength--;
        this.deselect(model, _.extend({}, options, {_silentLocally: true}));
      }, this);

      this.selectedLength = 0;
      triggerMultiSelectEvents(this, prevSelected, options);
    },

    selectNone: function (options) {
      this.deselectAll(options);
    },

    // Toggle select all / none. If some are selected, it
    // will select all. If all are selected, it will select 
    // none. If none are selected, it will select all.
    toggleSelectAll: function (options) {
      if (this.selectedLength === this.length) {
        this.deselectAll(options);
      } else {
        this.selectAll(options);
      }
    },

    close: function () {
      unregisterCollectionWithModels(this);
      this.stopListening();
    }
  });

  // Select.Me
  // ----------------
  // A selectable mixin for Backbone.Model, allowing a model to be selected,
  // enabling it to work with Select.One or Select.Many, or on it's own.

  Select.Me = function () {};

  _.extend(Select.Me.prototype, {

    // Type indicator, undocumented, but part of the API (monitored by tests).
    // Can be queried safely by other components. Use it read-only.
    _pickyType: "Backbone.Select.Me",

    // Select this model, and tell our
    // collection that we're selected
    select: function (options) {
      var reselected = this.selected;

      options || (options = {});
      options._processedBy || (options._processedBy = []);

      if (options._processedBy[this.cid]) { return; }

      this.selected = true;
      options._processedBy[this.cid] = this;

      if (this._pickyCollections) {
        // Model-sharing mode: notify collections with an event
        this.trigger("_selected", this, stripLocalOptions(options));
      } else if (this.collection) {
        // Single collection only: no event listeners set up in collection, call
        // it directly
        if (!options._processedBy[this.collection._pickyCid]) this.collection.select(this, stripLocalOptions(options));
      }

      if (!(options.silent || options._silentLocally)) {
        if (reselected) {
          if (!options._silentReselect) this.trigger("reselected", this, stripInternalOptions(options));
        } else {
          this.trigger("selected", this, stripInternalOptions(options));
        }
      }
    },

    // Deselect this model, and tell our
    // collection that we're deselected
    deselect: function (options) {
      options || (options = {});
      if (!this.selected) { return; }

      this.selected = false;

      if (this._pickyCollections) {
        // Model-sharing mode: notify collections with an event
        this.trigger("_deselected", this, stripLocalOptions(options));
      } else if (this.collection) {
        // Single collection only: no event listeners set up in collection, call
        // it directly
        this.collection.deselect(this, stripLocalOptions(options));
      }

      if (!(options.silent || options._silentLocally)) this.trigger("deselected", this, stripInternalOptions(options));
    },

    // Change selected to the opposite of what
    // it currently is
    toggleSelected: function (options) {
      if (this.selected) {
        this.deselect(options);
      } else {
        this.select(options);
      }
    }
  });

  // Applying the mixin: class methods for setup
  Select.Me.applyTo = function (hostObject) {
    _.extend(hostObject, new Backbone.Select.Me());
    hostObject.trigger = trigger(hostObject);
  };

  Select.One.applyTo = function (hostObject, models, options) {

    _.extend(hostObject, new Backbone.Select.One());

    hostObject._pickyCid = _.uniqueId('singleSelect');
    hostObject.trigger = trigger(hostObject);

    if (options && options.enableModelSharing) {

      // model-sharing mode
      _.each(models || [], function (model) {
        registerCollectionWithModel(model, hostObject);
        if (model.selected) {
          if (hostObject.selected) hostObject.selected.deselect();
          hostObject.selected = model;
        }
      });

      hostObject.listenTo(hostObject, '_selected', hostObject.select);
      hostObject.listenTo(hostObject, '_deselected', hostObject.deselect);

      hostObject.listenTo(hostObject, 'reset', onResetSingleSelect);
      hostObject.listenTo(hostObject, 'add', onAdd);
      hostObject.listenTo(hostObject, 'remove', onRemove);

      // Mode flag, undocumented, but part of the API (monitored by tests). Can
      // be queried safely by other components. Use it read-only.
      hostObject._modelSharingEnabled = true;

    }

  };

  Select.Many.applyTo = function (hostObject, models, options) {

    _.extend(hostObject, new Backbone.Select.Many());

    hostObject._pickyCid = _.uniqueId('multiSelect');
    hostObject.selected = {};
    hostObject.trigger = trigger(hostObject);

    if (options && options.enableModelSharing) {

      // model-sharing mode
      _.each(models || [], function (model) {
        registerCollectionWithModel(model, hostObject);
        if (model.selected) hostObject.selected[model.cid] = model;
      });

      hostObject.listenTo(hostObject, '_selected', hostObject.select);
      hostObject.listenTo(hostObject, '_deselected', hostObject.deselect);

      hostObject.listenTo(hostObject, 'reset', onResetMultiSelect);
      hostObject.listenTo(hostObject, 'add', onAdd);
      hostObject.listenTo(hostObject, 'remove', onRemove);

      // Mode flag, undocumented, but part of the API (monitored by tests). Can
      // be queried safely by other components. Use it read-only.
      hostObject._modelSharingEnabled = true;

    }

  };

  // Helper Methods
  // --------------

  // Trigger events from a multi-select collection based on the number of
  // selected items.
  var triggerMultiSelectEvents = function (collection, prevSelected, options, reselected) {
    function mapCidsToModels (cids, collection, previousSelection) {
      function mapper (cid) {
        // Find the model in the collection. If not found, it has been removed,
        // so get it from the array of previously selected models.
        return collection.get(cid) || previousSelection[cid];
      }
      return _.map(cids, mapper);
    }

    options || (options = {});
    if (options.silent || options._silentLocally) return;

    var selectedLength = collection.selectedLength,
        length = collection.length,
        prevSelectedCids = _.keys(prevSelected),
        selectedCids = _.keys(collection.selected),
        addedCids = _.difference( selectedCids, prevSelectedCids ),
        removedCids = _.difference( prevSelectedCids, selectedCids ),
        unchanged = (selectedLength === prevSelectedCids.length && addedCids.length === 0 && removedCids.length === 0),
        diff;

    if (reselected && reselected.length && !options._silentReselect) {
      collection.trigger("reselect:any", reselected, collection, stripInternalOptions(options));
    }

    if (unchanged) return;

    diff = {
      selected: mapCidsToModels(addedCids, collection, prevSelected),
      deselected: mapCidsToModels(removedCids, collection, prevSelected)
    };

    if (selectedLength === length) {
      collection.trigger("select:all", diff, collection, stripInternalOptions(options));
      return;
    }

    if (selectedLength === 0) {
      collection.trigger("select:none", diff, collection, stripInternalOptions(options));
      return;
    }

    if (selectedLength > 0 && selectedLength < length) {
      collection.trigger("select:some", diff, collection, stripInternalOptions(options));
      return;
    }
  };

  function onAdd (model, collection) {
    registerCollectionWithModel(model, collection);
    if (model.selected) collection.select(model, {_silentReselect: true, _externalEvent: "add"});
  }

  function onRemove (model, collection, options) {
    releaseModel(model, collection, _.extend({}, options, {_externalEvent: "remove"}));
  }

  function releaseModel (model, collection, options) {
    if (model._pickyCollections) model._pickyCollections = _.without(model._pickyCollections, collection._pickyCid);
    if (model.selected) {
      if (model._pickyCollections && model._pickyCollections.length === 0) {
        collection.deselect(model, options);
      } else {
        collection.deselect(model, _.extend({}, options, {_skipModelCall: true}));
      }
    }
  }

  function onResetSingleSelect (collection, options) {
    var selected,
        excessiveSelections,
        deselectOnRemove = _.find(options.previousModels, function (model) { return model.selected; });

    if (deselectOnRemove) releaseModel(deselectOnRemove, collection, {_silentLocally: true});
    _.each(options.previousModels, function (model) {
      if (model._pickyCollections) model._pickyCollections = _.without(model._pickyCollections, collection._pickyCid);
    });

    collection.each(function (model) {
      registerCollectionWithModel(model, collection);
    });
    selected = collection.filter(function (model) { return model.selected; });
    excessiveSelections = _.initial(selected);
    if (excessiveSelections.length) _.each(excessiveSelections, function (model) { model.deselect(); });
    if (selected.length) collection.select(_.last(selected), {silent: true});
  }

  function onResetMultiSelect (collection, options) {
    var select,
        deselect = _.filter(options.previousModels, function (model) { return model.selected; });

    if (deselect) _.each(deselect, function (model) { releaseModel(model, collection, {_silentLocally: true}); });

    _.each(options.previousModels, function (model) {
      if (model._pickyCollections) model._pickyCollections = _.without(model._pickyCollections, collection._pickyCid);
    });

    collection.each(function (model) {
      registerCollectionWithModel(model, collection);
    });
    select = collection.filter(function (model) { return model.selected; });
    if (select.length) _.each(select, function (model) { collection.select(model, {silent: true}); });
  }

  function registerCollectionWithModel (model, collection) {
    model._pickyCollections || (model._pickyCollections = []);
    model._pickyCollections.push(collection._pickyCid);
  }

  function unregisterCollectionWithModels (collection) {
    collection.each(function (model) {
      releaseModel(model, collection, {_silentLocally: true});
    });
  }

  function stripLocalOptions (options) {
    return _.omit(options, "_silentLocally", "_externalEvent");
  }

  function stripInternalOptions (options) {
    return _.omit(options, "_silentLocally", "_silentReselect", "_skipModelCall", "_processedBy");
  }

  function multiSelectionToArray (selectionsHash) {
    function mapper (value, key) {
      selectedArr[key] = value;
    }

    var selectedArr = [];
    _.each(selectionsHash, mapper);

    return selectedArr;
  }

  // Creates a new trigger method which calls the predefined event handlers
  // (onDeselect etc) as well as triggering the event.
  //
  // Adapted from Marionette.triggerMethod.
  function trigger (context) {

    // Take the event section ("section1:section2:section3")
    // and turn it into an uppercase name
    //noinspection JSUnusedLocalSymbols
    function getEventName (match, prefix, eventName) {
      return eventName.toUpperCase();
    }

    // Unifies event names for the method call:
    // - (re, de)selected   => (re, de)select
    // - (re, de)select:one => (re, de)select
    // - reselect:any       => reselect
    function unifyEventNames (eventName) {
      if (eventName.slice(-2) === "ed" ) {
        eventName = eventName.slice(0, -2);
      } else if (eventName.slice(-4) === ":one" || eventName.slice(-4) === ":any") {
        eventName = eventName.slice(0, -4);
      }

      return eventName;
    }

    var origTrigger = context.trigger,

    // Split the event name on the ":"
        splitter = /(^|:)(\w)/gi;

    // Return an augmented trigger method implementation, in order to replace
    // the original trigger method
    return function (event, eventArgs) {
      // get the method name from the event name
      var unifiedEvent = unifyEventNames(event),
          internalEvent = (unifiedEvent.charAt(0) === "_"),
          methodName = 'on' + unifiedEvent.replace(splitter, getEventName),
          method = this[methodName];

      // call the onMethodName if it exists
      if (!internalEvent && _.isFunction(method)) {
        // pass all trigger arguments, except the event name
        method.apply(this, _.tail(arguments));
      }

      // trigger the event
      origTrigger.apply(this, arguments);
      return this;

    };
  }

  return Select;
})(Backbone, _);
