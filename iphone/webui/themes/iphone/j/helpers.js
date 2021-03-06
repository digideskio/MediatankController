(function() {
	var timestamp = new Date().getTime();

	function checkResume() {
		var current = new Date().getTime();
		if (current - timestamp > 4000) {
			var event = document.createEvent("Events"); 
			event.initEvent("resume", true, true); 
			document.dispatchEvent(event); 
		}
		timestamp = current;
	}
	
	window.setInterval(checkResume, 1000);
})();	
	
	
	
Effect = {};
Effect.Fade = function(element) {
	var element = $(element);
	element.addEventListener('webkitTransitionEnd', end);
	element.style.webkitTransitionProperty = 'opacity';
	element.style.webkitTransitionDuration = '300ms';
	window.setTimeout(start, 0);
	
	function start() {
		element.style.opacity = 0;	
	}
	
	function end() {
		element.removeEventListener('webkitTransitionEnd', end);
		element.style.webkitTransitionProperty = '';
		element.style.webkitTransitionDuration = '';
		element.style.display = 'none';
		element.style.opacity = 1;
	}
};

Effect.Appear = function(element) {
	var element = $(element);
	element.style.opacity = 0;
	element.style.display = '';
	element.addEventListener('webkitTransitionEnd', end);
	element.style.webkitTransitionProperty = 'opacity';
	element.style.webkitTransitionDuration = '300ms';
	window.setTimeout(start, 0);
	
	function start() {
		element.style.opacity = 1;	
	}
	
	function end() {
		element.removeEventListener('webkitTransitionEnd', end);
		element.style.webkitTransitionProperty = '';
		element.style.webkitTransitionDuration = '';
	}
};
	
	
	
Connection = Class.create();
Connection.prototype = {
	initialize: function(application) {
		this.application = application;
		
		document.body.addEventListener("online", this.online.bind(this));
		document.body.addEventListener("offline", this.offline.bind(this));

		if (navigator.onLine) {
			this.interval = window.setInterval(this.ping.bind(this), 30 * 1000);
		}
	},
	
	online: function() {
		this.interval = window.setInterval(this.ping.bind(this), 30 * 1000);
		this.ping();
	},
	
	offline: function() {
		window.clearInterval(this.interval);
		this.application.offline = true;
	},
	
	resume: function() {
		if (navigator.onLine) {
			this.ping();
		} else {
			window.setTimeout(this.ping.bind(this), 4000);
		}
	},

	ping: function() {
		var req = new XMLHttpRequest();

		req.onerror = function() {
			this.application.offline = true;
		}.bind(this);

		req.onreadystatechange = function() {
			if (req.readyState == 4) {
				this.application.offline = false;
			}
		}.bind(this);

		req.open("GET", "../../index.php?action=ping", true);
		req.send(null);
	}
};



Storage = Class.create();
Storage.prototype = {
	initialize: function(options) {
		this.options = options;
		this.database = null;
		
		try {
			if (window.openDatabase) {
				this.database = openDatabase(this.options.shortName, '1.0', this.options.displayName, 65536);
				
				if (this.database) {
					this.database.transaction(function (transaction) {
						transaction.executeSql('CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY NOT NULL DEFAULT "", data TEXT NOT NULL DEFAULT "");');
					});        			
				}
			}
		} catch(e) {
			alert("Error: " + e);
			return;
		}					
	},
		
	read: function(key, success, fallback) {
		if (!this.database) {
			fallback();
			return;
		}					
			
		this.database.transaction(function (transaction) {
			transaction.executeSql("SELECT data FROM storage WHERE key=?;", [ key ], function(transaction, results) {
				if (results.rows.length) {
					var row = results.rows.item(0);
					success(row['data'].evalJSON());
				} else {
					fallback();
				}
			}, fallback);
		});					
	},
		
	write: function(key, data) {
		if (!this.database) {
			return;
		}
			
		var json = Object.toJSON(data);
			
		this.database.transaction(function (transaction) {
			transaction.executeSql("INSERT OR REPLACE INTO storage (key, data) VALUES (?, ?);", [ key, json ]); 
		});
	},
		
	clear: function(callback) {
		if (!this.database) {
			return;
		}
			
		this.database.transaction(function (transaction) {
			transaction.executeSql("DELETE FROM storage;", [], callback); 
			transaction.executeSql('DROP TABLE storage;');
		});
	}
};


IUILoader = Class.create();
IUILoader.prototype = {
	initialize: function(application, options) {
		this.application = application;
		this.options = options;
		this.current = null;
		
		iui.onPagePrepare(this.onPrepare.bind(this));
		iui.onPageChange(this.onChange.bind(this));
	},
	
	onPrepare: function(id) {
		var event = document.createEvent("Events"); 
		event.initEvent("onBeforePageChange", true, true); 
		event.from = this.current;
		event.to = id;
		document.dispatchEvent(event); 

		this.options.onPrepare(id);
	},

	onChange: function(id) {
		var event = document.createEvent("Events"); 
		event.initEvent("onAfterPageChange", true, true); 
		event.from = this.current;
		event.to = id;
		document.dispatchEvent(event); 

		this.current = id;
		this.options.onChange(id);
	},
	
	clearHistory: function() {
		iui.clearHistory();
	},
	
	insertIntoHistory: function(page) {
		iui.insertIntoHistory(page);
	},
	
	goto: function(id, backwards) {
		iui.showPage($(id), backwards);
	},
	
	gotoWithoutAnimation: function (id) {
		iui.updatePage($(id), iui.getCurrentPage());
	},
	
	updateTitle: function() {
		iui.updateTitle();
	}
};


EnhancedClickHandler = Class.create();
EnhancedClickHandler.prototype = {
	initialize: function(el, options) {
		this.element = $(el);
		this.turbo = options ? false || options.turbo : false;
		this.highlight = options ? false || options.highlight : false;
		this.hold = options ? false || options.hold : false;
		this.className = options ? false || options.className : false;
		this.prevent = options ? false || options.prevent : false;
		this.moveBack = options ? false || options.moveBack : false;
	
		this.target = null;
		this.radius = 100;
	
		if (window.Touch) {
			this.element.addEventListener('touchstart', this, false);
			this.element.addEventListener('click', this, true);
		}
	},

	inRadius: function(x, y) {
		return (x > this.left && x < this.right && y > this.top && y < this.bottom);
	},

	handleEvent: function(e) {
		switch(e.type) {
			case 'touchstart': this.onTouchStart(e); break;
			case 'touchmove': this.onTouchMove(e); break;
			case 'touchend': this.onTouchEnd(e); break;
			case 'click': this.onClick(e); break;
		}
	},
	
	onClick: function(e) {
		if (!e.custom) {
			e.stopPropagation();
			e.preventDefault();
		}
	},

	onTouchStart: function(e) {
		e.stopPropagation();
		
		if (this.prevent) {
			e.preventDefault();	
		}

		this.target = document.elementFromPoint(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
		if (this.target.nodeType == 3) this.target = this.target.parentNode;
		while (this.target.tagName.toLowerCase() != 'a' && this.target.tagName.toLowerCase() != 'h1') {
			if (this.target.tagName.toLowerCase() == 'html') {
				this.target = null;
				return;
			}

			this.target = this.target.parentNode;
		}

		this.initTime = e.timeStamp;
		this.initY = e.targetTouches[0].clientY;
		this.initX = e.targetTouches[0].clientX;

		if (this.turbo) {
			e.preventDefault();
			
			var event = document.createEvent('MouseEvents');
			event.initEvent('click', true, true);
			event.custom = true;
			this.target.dispatchEvent(event);
		} else {
			this.top = 0;
			this.left = 0;
			
			var element = this.target;
			while (element.offsetParent) {
				this.top += element.offsetTop;
				this.left += element.offsetLeft;
				element = element.offsetParent;
			}
			
			this.x = parseInt(this.left + (this.target.offsetWidth / 2), 10);
			this.y = parseInt(this.top + (this.target.offsetHeight / 2), 10);
			this.bottom = this.top + this.target.offsetHeight + this.radius;
			this.right = this.left + this.target.offsetWidth + this.radius;
			this.left = this.left - this.radius;
			this.top = this.top - this.radius;
			
			if (this.className) {
				Element.addClassName(this.target, this.className);	
			}
			
			if (this.highlight) {
				this.feedback = document.createElement('img');
				this.feedback.src = '../iphone/i/g/highlight.png';
				this.feedback.style.position = 'absolute';
				this.feedback.style.display = 'block';
				this.feedback.style.zIndex = 1000;
				this.feedback.style.top = Math.round(this.y - 37) + 'px';
				this.feedback.style.left = Math.round(this.x - 37) + 'px';
				this.feedback.style.width = '74px';
				this.feedback.style.height = '74px';
				this.feedback.style.minHeight = '74px';
				this.feedback.style.background = 'none';
				this.feedback.style.webkitTransitionProperty = 'opacity';
				this.feedback.style.webkitTransitionDuration = '200ms';
				this.feedback.style.pointerEvents = 'none';
				document.body.appendChild(this.feedback);
			}

			this.moved = false;
			this.element.addEventListener('touchmove', this, false);
			this.element.addEventListener('touchend', this, false);
		}
	},

	onTouchMove: function(e) {
		e.stopPropagation();
		
		if (this.moveBack) {
			if (!this.inRadius(e.targetTouches[0].clientX, e.targetTouches[0].clientY))
			{	
				this.moved = true;
				
				if (this.feedback) {
					this.feedback.style.opacity = 0;	
				}
				
				if (this.className) {
					Element.removeClassName(this.target, this.className);	
				}
			} else {
				this.moved = false;

				if (this.feedback) {
					this.feedback.style.opacity = 1;	
				}
				
				if (this.className) {
					Element.addClassName(this.target, this.className);	
				}
			}
		} else {
			this.moved = true;
			
			if (this.feedback) {
				this.feedback.style.opacity = 0;	
			}
			
			if (this.className) {
				Element.removeClassName(this.target, this.className);	
			}
		
			this.element.removeEventListener('touchmove', this, false);
			this.element.removeEventListener('touchend', this, false);
		}
	},

	onTouchEnd: function(e) {
		this.element.removeEventListener('touchmove', this, false);
		this.element.removeEventListener('touchend', this, false);
		
		if (this.highlight) {
			this.feedback.style.pointerEvents = 'auto';
		}

		if (this.className) {
			Element.removeClassName(this.target, this.className);	
		}
		
		if (!this.moved) {
			e.preventDefault();
			e.stopPropagation();

			if (this.hold) {
				if (e.timeStamp - this.initTime > 500) {
					var event = document.createEvent("Events"); 
				    event.initEvent("gesturehold", true, true); 
					event.target = this.target;
					event.x = this.initX;
					event.y = this.initY;
	     			this.target.dispatchEvent(event); 
					return;
				}
			}

			var event = document.createEvent('MouseEvents');
			event.initEvent('click', true, true);
			event.custom = true;
			this.target.dispatchEvent(event);

			if (this.highlight) {
				this.feedback.addEventListener('webkitTransitionEnd', function() {
					Element.remove(this.feedback);
				}.bind(this), false);
				this.feedback.style.opacity = 0;	
			}
		} else {
			if (this.highlight) {
				Element.remove(this.feedback);
			}
		}
	}
};



function createUUID() {
    // http://www.ietf.org/rfc/rfc4122.txt
    var s = [];
    var hexDigits = "0123456789abcdef";
    for (var i = 0; i < 32; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[12] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
    s[16] = hexDigits.substr((s[16] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01

    var uuid = s.join("");
    return uuid;
}
