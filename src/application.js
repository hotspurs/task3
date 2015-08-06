modules.define('loader', ['i-bem__dom'], function(provide, BEMDOM){
    provide( BEMDOM.decl(this.name, {
        onSetMod : {
            js : {
                inited : function(){
                    console.log('loader inited')
                }
            }
        },
        _onFileChange : function(e){
            var files = e.target.files;
            this._loadFiles(files);
        },
        _onDropZoneDrop : function(e){
            var files = e.originalEvent.dataTransfer.files;
            e.stopPropagation();
            e.preventDefault();
            this._loadFiles(files);
        },
        _onDropZoneDragOver : function(e){
            console.log('HERE');
            e.stopPropagation();
            e.preventDefault();        
        },
        _loadFiles : function(files){
            
            for(var i = 0; i < files.length; i++){
                var self = this;
                (function(){
                    var name = files[i].name;
                    var reader = new FileReader();
                    reader.onload = function(e){
                        var data = e.target.result
                        self.emit('load', { buffer : data, name : name })
                    }
                    reader.readAsArrayBuffer(files[i])
                })();
            }

        }
    },
    {
        live : function(){
            this.liveBindTo('file', 'change', function(e){
                this._onFileChange(e);
            })

            this.liveBindTo('drop-zone', 'drop', function(e){
                this._onDropZoneDrop(e);
                this.delMod(this.elem('drop-zone'), 'over');
            });

            this.liveBindTo('drop-zone', 'dragover', function(e){
                this._onDropZoneDragOver(e);
            });

            this.liveBindTo('drop-zone', 'dragenter', function(e){
                this.setMod(this.elem('drop-zone'), 'over');
            });

            this.liveBindTo('drop-zone', 'dragleave', function(e){
                this.delMod(this.elem('drop-zone'), 'over');
            });
        }
    }
    ));
});
modules.define('progress', ['i-bem__dom'], function(provide, BEMDOM){
  provide( BEMDOM.decl(this.name, {
    onSetMod : {
      js : {
        inited : function(){
          console.log('Init progress');
          this._width = this.domElem.width();
          this.value = 0;
          this.active = false;
          this.findBlockOutside('player').on('progressActive',this._onActive, this);
        }
      }
    },
    _onActive : function(){
        console.log('Progress active');
        this.active = true;
    },
    _setCurrentWidth : function(value){
        this.elem('current').width(value+'%')
    }
  },{
    live : function(){

        this.liveBindTo('click', function(e){
            if(this.active)
              this._onClick(e);
        })        

        return false;
    }
  }))
});


modules.define('progress', function(provide, progress){
  provide(progress.decl({ modName : 'type', modVal : 'time'}, {
    onSetMod : {
      js : {
        inited : function(){
          console.log('Init progress time');
          this._width = this.domElem.width();
          this.value = 0;
          this.active = false;
          this.findBlockOutside('player').on('progressActive',this._onActive, this);
          this.findBlockOutside('player').on('onProgress', this._onProgress, this);
        }
      }
    },
    _onProgress : function(e, data){
      this._setCurrentWidth(data.value);
    },
    _onClick : function(e){
        this.value = Math.round( (e.offsetX / this._width) * 100);
        this._setCurrentWidth(this.value);
        this.emit('change', { value : this.value});
    }
  },
  {

  }))
});
modules.define('player', ['i-bem__dom'], function(provide, BEMDOM){

  function getAudioContext(){
    if(typeof AudioContext !== 'undefined'){
        return new AudioContext();
    }
    else if(typeof webkitAudioContext !== 'undefined'){
        return new webkitAudioContext();
    }
    else if(typeof mozAudioContext !== 'undefined'){
        return mozAudioContext();
    }
    else{
        throw new Error('AudioContext not supported');
    }
  }

  provide(BEMDOM.decl(this.name, {
        onSetMod: {
            js: {
                inited: function() {
                    console.log('Player inited');
                    this._audioContext = getAudioContext();
                    this._analyser = this._audioContext.createAnalyser();
                    this._analyser.connect(this._audioContext.destination);
                    this._settingAnalyser();
                    this._playList = [];
                    this._isPlaying = false;
                    this.visualizator = this.findBlockInside('visualizator');
                    this.elem('wrapper').draggable({ cancel: '.player__action, .player__progress, .player__time, .player__volume, .player__icon', stack:'div'});

                    this.findBlocksInside('progress')[1].on('change', this._onChangeProgress, this );

                    this.bindTo( this.elem('icon', 'visualizator'), 'click', this._toggleVisualizator );

                }
            }
        },

        _settingAnalyser : function(){
            this._analyser.minDecibels = -140;
            this._analyser.maxDecibels = 0;
            this._analyser.smothngTimeConstant = 0.8;
            this._analyser.fftSize = 2048;
            this._freqs = new Uint8Array(this._analyser.frequencyBinCount);
        },
        _toggleVisualizator : function(){
            if( this.hasMod( this.elem('icon', 'visualizator'), 'inited' ) ){
                this.toggleMod( this.elem('icon', 'visualizator'), 'active' );
                this.emit('toggleVisualizator');
            }
        },
        _onChangeProgress : function(e, data){
            this._currentSongTime =  this._playList[this._currentSong].buffer.duration / 100 * data.value;
            if(this._isPlaying){
              this.stop();
              this.play();
            }

        },
        _decodeAndSaveBuffer : function(data){
            console.log('DecodeAudioData.... ')
            var startDecodeTime = +new Date;
            var self = this;
            this.setMod(this.elem('spiner'), 'visible');
            this._audioContext.decodeAudioData(data.buffer, function(buffer){
                var endtDecodeTime = +new Date;
                console.log('Total decode time', (endtDecodeTime - startDecodeTime) / 1000 );
                self._playList.push( { name : data.name, buffer : buffer } );
                console.log(self._playList);
                self.delMod(self.elem('spiner'), 'visible');
                if(!self._source && self._playList.length === 1){
                    self._createBufferSource();
                    self._setAtIndex(0);
                    self.emit('progressActive');
                    self.setMod(self.elem('icon'), 'inited');
                }
            },function(e){
                "Error with decoding audio data" + e.err
            }
            );
        },
        _createBufferSource : function(){
            this._source = this._audioContext.createBufferSource();
            this._source.connect(this._analyser);
        },
        _setTime : function(duration){
          var roudDuration = Math.round(duration),
              minutes = Math.floor(roudDuration / 60),
              seconds = roudDuration % 60;
            this.elem('time').text(minutes+':'+seconds);
        },
        _setSongName : function(name){
            this.elem('song').text(name);
        },
        _onSongEnd : function(){
            this._isPlaying = false;
            this._source =  null;
            this.toggleMod(this.elem('action'),'stop');
            this._currentSongTime = 0.0;
            this.emit('onProgress', { value : 0 });
            setTimeout( this.visualizator.clear.bind(this.visualizator), 50 );
        },
        play : function(){
            console.log('PLAY');
            var self = this;
            this._isPlaying = true;
            this._currentSongStartTime = this._audioContext.currentTime;

            if(!this._source){
                this._createBufferSource();
                this._setAtIndex(this._currentSong);

            }
            
            this.rafTimer = requestAnimationFrame(this.visualizator.draw.bind(this.visualizator));

            this._source.start( this._audioContext.currentTime, this._currentSongTime );

            this.progressTimer = setInterval(function(){
                var currentTime = (self._audioContext.currentTime - self._currentSongStartTime ) + self._currentSongTime;
                var value = Math.round( (currentTime / self._playList[self._currentSong].buffer.duration)*100 );
                console.log('Value', value);
                self.emit('onProgress', { value : value })
            }, 1000);

            this.endOfSongTimer = setTimeout(function(){
                clearInterval(self.progressTimer);
                self._onSongEnd();
            }, Math.round( self._playList[self._currentSong].buffer.duration - self._currentSongTime)* 1000  )
           
        },
        stop : function(){
            console.log('STOP');
            cancelAnimationFrame(this.rafTimer);
            cancelAnimationFrame(this.visualizator.rAfTimer);
            console.log('что тут?',this.rafTimer)
            this.rafTimer = null;
            clearInterval(this.progressTimer);
            clearTimeout(this.endOfSongTimer);
            this._currentSongTime += (this._audioContext.currentTime - this._currentSongStartTime);
            console.log('Текущие время песни ', this._currentSongTime);
            this._source.stop();
            this._isPlaying = false;
            this._source =  null;
        },
        _setAtIndex : function(index){
           var song = this._playList[index];
           this._source.buffer = song.buffer;
           this._currentSong = index;
           this._setTime(song.buffer.duration);
           this._setSongName(song.name);
        },
        _currentSongStartTime : 0.0,
        _currentSong : null,
        _currentSongTime : 0.0
    },
    {
       live : function(){
          var self = this;

          this.liveInitOnBlockInsideEvent('load', 'loader', function(e, data){
             this._decodeAndSaveBuffer(data);
          });

          this.liveBindTo('action', 'click', function(e){
            if(this._playList.length === 0) return;
            if(this._isPlaying) this.stop();
            else this.play();
            this.toggleMod(this.elem('action'),'stop');
          });

          return false; 
       }
    }
    ));
});
modules.define('visualizator', ['i-bem','i-bem__dom'], function(provide, BEM, BEMDOM){
  
  provide(BEMDOM.decl(this.name, {
    onSetMod : {
      js : {
      	inited : function(){
          console.log('Visualizator inited');
          this.player = this.findBlockOutside('player');
          this._canvas = this.elem('canvas')[0];
          BEM.blocks['player'].on('toggleVisualizator', this._onToggle, this);
          this.domElem.draggable({stack:'div'});
          this.bindTo( this.elem('close'), 'click', this._onClickClose );
      	}
      }
    },
    draw : function(){
      console.log('DRAW');
      var width,
          canvasheight,
          canvasWidth,
          drawContext = this._canvas.getContext('2d');
      canvasWidth = this._canvas.width = 220;
      canvasheight = this._canvas.height = 196;
      this.player._analyser.getByteFrequencyData(this.player._freqs);
      width = Math.floor(1/this.player._freqs.length,10);
      for(var i = 0; i < this.player._analyser.frequencyBinCount; i++){
        var value = this.player._freqs[i],
            percent = value / 256,
            height = canvasheight * percent,
            offset = canvasheight - height - 1,
            barWidth = canvasWidth / this.player._analyser.frequencyBinCount,
            hue = i / this.player._analyser.frequencyBinCount * 360;

            drawContext.fillStyle = 'hsl('+ hue + ', 100%, 50%)';
            drawContext.fillRect(i * barWidth, offset, barWidth, height);
      }
      if(this.player._isPlaying){
        this.rAfTimer = requestAnimationFrame(this.draw.bind(this));
      }
    },
    clear : function(){
      console.log('Clear');
      this._canvas.getContext('2d').clearRect(0, 0, this._canvas.width, this._canvas.height);
    },
    _onToggle : function(){
      this.toggleMod('visible');
      this._setCords();
    },
    _onClickClose : function(){
      this.player._toggleVisualizator();
    },
    _setCords : function(){

      var playerElemWrapper = this.player.elem('wrapper'),
          playerElemWrapperOffset = playerElemWrapper.offset(),
          top = playerElemWrapperOffset.top,
          left = playerElemWrapperOffset.left + playerElemWrapper.width() + 10;

      this.domElem.css({ top : top, left : left});
    }
  },{
  }))
});
modules.require(
    ['i-bem__dom_init', 'jquery', 'next-tick'],
    function(init, $, nextTick) {

    $(function() {
        nextTick(init);
    });
});
