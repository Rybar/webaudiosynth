console.clear();

/**
 * We're loading React, prop-types and ReactDOM in via the JS panel settings.
**/

const NOTES = {
  "A-0": 27.5,
  "A#0": 29.1352,
  "B-0": 30.8677,
  "C-1": 32.7032,
  "C#1": 34.6478,
  "D-1": 36.7081,
  "D#1": 38.8909,
  "E-1": 41.2034,
  "F-1": 43.6535,
  "F#1": 46.2493,
  "G-1": 48.9994,
  "G#1": 51.9131,
  "A-1": 55,
  "A#1": 58.2705,
  "B-1": 61.7354,
  "C-2": 65.4064,
  "C#2": 69.2957,
  "D-2": 73.4162,
  "D#2": 77.7817,
  "E-2": 82.4069,
  "F-2": 87.3071,
  "F#2": 92.4986,
  "G-2": 97.9989,
  "G#2": 103.826,
  "A-2": 110,
  "A#2": 116.541,
  "B-2": 123.471,
  "C-3": 130.813,
  "C#3": 138.591,
  "D-3": 146.832,
  "D#3": 155.563,
  "E-3": 164.814,
  "F-3": 174.614,
  "F#3": 184.997,
  "G-3": 195.998,
  "G#3": 207.652,
  "A-3": 220,
  "A#3": 233.082,
  "B-3": 246.942,
  "C-4": 261.626,
  "C#4": 277.183,
  "D-4": 293.665,
  "D#4": 311.127,
  "E-4": 329.628,
  "F-4": 349.228,
  "F#4": 369.994,
  "G-4": 391.995,
  "G#4": 415.305,
  "A-4": 440,
  "A#4": 466.164,
  "B-4": 493.883,
  "C-5": 523.251,
  "C#5": 554.365,
  "D-5": 587.33,
  "D#5": 622.254,
  "E-5": 659.255,
  "F-5": 698.456,
  "F#5": 739.989,
  "G-5": 783.991,
  "G#5": 830.609,
  "A-5": 880,
  "A#5": 932.328,
  "B-5": 987.767,
  "C-6": 1046.5,
  "C#6": 1108.73,
  "D-6": 1174.66,
  "D#6": 1244.51,
  "E-6": 1318.51,
  "F-6": 1396.91,
  "F#6": 1479.98,
  "G-6": 1567.98,
  "G#6": 1661.22,
  "A-6": 1760,
  "A#6": 1864.66,
  "B-6": 1975.53,
  "C-7": 2093,
  "C#7": 2217.46,
  "D-7": 2349.32,
  "D#7": 2489.02,
  "E-7": 2637.02,
  "F-7": 2793.83,
  "F#7": 2959.96,
  "G-7": 3135.96,
  "G#7": 3322.44,
  "A-7": 3520,
  "A#7": 3729.31,
  "B-7": 3951.07,
  "C-8": 4186.01
};


// Step sequencer (singleton)
const sequencerTimer = (() => {
  
  let NUM_STEPS = 16;
  let NUM_BEATS = 4;
  
  let READ_AHEAD_TIME = 0.005; // time in s
  let UPDATE_INTERVAL = 10; // time in ms
  
  let tempo = 120;
  let stepDuration = (60 / tempo) / NUM_BEATS; // 16 steps/bar

  let playStartTime = 0;
  let nextStepTime = 0;
  let currentStepIndex = 0;
  let isPlaying = false;
  
  let ti;
  let stepCallbacks = [];
  
  // Advance the 'playhead' in the sequence (w/ looping)
  const nextStep = () => {
    if (!isPlaying) return false;
    
    currentStepIndex++;
    if(currentStepIndex === NUM_STEPS) currentStepIndex = 0;
    nextStepTime += stepDuration;
  };
  
  // Schedule callbacks to fire for every step within 
  // the current 'window', and check again in a moment
  const update = () => {
    while(nextStepTime < Synth.AC.currentTime + READ_AHEAD_TIME) {
      stepCallbacks.forEach((cb) => cb(currentStepIndex, nextStepTime));
      nextStep();
    }
    
    ti = setTimeout(() => {
      update();
    }, UPDATE_INTERVAL);
  };
  
  const registerStepCallback = (callback) => {
    stepCallbacks.push(callback);
  };
  
  const unregisterStepCallback = (callback) => {
    stepCallbacks = stepCallbacks.filter((cb) => cb !== callback);
  };

  const start = () => {
    if (isPlaying) return;
    
    isPlaying = true;
    
    currentStepIndex = 0;
    nextStepTime = Synth.AC.currentTime;
    
    update();
  };
  
  const stop = () => {
    isPlaying = false;
    clearTimeout(ti);
  };
  
  return {
    start,
    stop,
    registerStepCallback,
    unregisterStepCallback
  };
  
})();


// Synth class

class Synth {
  static AC = new (AudioContext || webkitAudioContext)();
  
  static TYPES = ['sine', 'square', 'triangle', 'sawtooth'];
  static TYPES_ABBR = ['sin', 'squ', 'tri', 'saw'];
  static ADSR_TARGETS = ['adsr','filter'];
  
  static MAX_UNISON_WIDTH = 30;
  static MAX_ADSR_STAGE_DURATION = 2;
  static MAX_ECHO_DURATION = 2;
  static MIN_FILTER_FREQ = 40;
  static MAX_FILTER_Q = 30;
  
  static PARAM_DEFAULTS = {
    unisonWidth: 0.2,
    volume: 0.3,
    adsrAttack: 0.2,
    adsrDecay: 0,
    adsrSustain: 1,
    adsrRelease: 0.2,
    adsrTarget: 0,
    filterFreq: 0.5,
    filterQ: 0.2,
    echoTime: 0,
    echoFeedback: 0,
    waveform: 3
  };
  
  constructor(params = {}) {
    if (!Synth.AC) throw 'Synth: Web Audio not supported!';
    
    console.log('New Synth', Synth.AC.currentTime);
    
    this.oscillators = new Array(3);
    
    this.params = {
      ...Synth.PARAM_DEFAULTS,
      ...params
    };
    
    this.nodes = {};
    
    this.nodes.volume = Synth.AC.createGain();
    this.setParam('volume');
    
    this.nodes.adsr = Synth.AC.createGain();
    
    this.nodes.filter = Synth.AC.createBiquadFilter();
    this.nodes.filter.type = 'lowpass';
    this.setParam('filterFreq');
    this.setParam('filterQ');
    
    this.nodes.delay = Synth.AC.createDelay(Synth.MAX_ECHO_DURATION);
    this.nodes.feedback = Synth.AC.createGain();
    this.setParam('echoTime');
    this.setParam('echoFeedback');
    
    this.nodes.analyser = Synth.AC.createAnalyser();
    this.nodes.analyser.smoothingTimeConstant = 0.5;
    this.nodes.analyser.fftSize = 256;
    this.analyserBufferLength = this.nodes.analyser.frequencyBinCount;
    this.analyserData = new Uint8Array(this.analyserBufferLength);
    
    this.nodes.adsr.connect(this.nodes.filter);
    this.nodes.filter.connect(this.nodes.delay);
    this.nodes.delay.connect(this.nodes.feedback);
    this.nodes.feedback.connect(this.nodes.delay);
    
    this.nodes.filter.connect(this.nodes.volume);
    this.nodes.feedback.connect(this.nodes.volume);
    
    this.nodes.volume.connect(this.nodes.analyser);
    this.nodes.analyser.connect(Synth.AC.destination);
    
    this.sequence = [
      'C-3',
      'D#3',
      'G-3',
      'C-3',

      'D-3',
      'D#3',
      'C-3',
      'D-3',

      'D#3',
      'C-3',
      'D#3',
      'G#3',

      'C-3',
      'G-3',
      'C-3',
      'G-3'
    ];
    this.isPlaying = false;
  }
  
  getAnalyserData = () => {
    this.nodes.analyser.getByteTimeDomainData(this.analyserData);
    return this.analyserData;
  };
  
  setParam = (param, value = this.params[param]) => {
    if(param && param in this.params) this.params[param] = value;
    
    switch(param) {
      case 'volume':
        this.nodes.volume.gain.value = value;
        break;
      case 'filterFreq':
        this.nodes.filter.frequency.value = this.calcFreqValue(value);
        break;
      case 'filterQ':
        this.nodes.filter.Q.value = value * Synth.MAX_FILTER_Q;
        break;
      case 'echoTime':
        this.nodes.delay.delayTime.value = value * Synth.MAX_ECHO_DURATION;
        break;
      case 'echoFeedback':
        this.nodes.feedback.gain.value = value;
        break;
      case 'unisonWidth':
        const width = this.getUnisonWidth(value);
        this.oscillators[1].detune.value = -width;
        this.oscillators[2].detune.value = width;
        break;
      default:
        break;
    }
  };
    
  getUnisonWidth = (amt) => amt * Synth.MAX_UNISON_WIDTH;
  
  calcFreqValue = (amt) => Math.max(Synth.MIN_FILTER_FREQ, amt * (Synth.AC.sampleRate / 2));
  
  getADSRTarget = () => {
    const tgtName = Synth.ADSR_TARGETS[this.params.adsrTarget];
    switch (tgtName) {
      case 'filter': {
        return this.nodes.filter.frequency;
      }
      case 'adsr':
      default: {
        return this.nodes.adsr.gain;
      }
    }
  };
  
  getADSRValue = (val) => {
    const tgtName = Synth.ADSR_TARGETS[this.params.adsrTarget];
    switch (tgtName) {
      case 'filter': {
        const tgt = this.calcFreqValue(val);
        const max = this.calcFreqValue(this.params.filterFreq);
        return Math.min(tgt, max);
      }
      case 'adsr':
      default: {
        return val;
      }
    }
  }
  
  noteOn = (freq, t = 0) => {
    Synth.AC.resume();
    
    this.killOscillators(t);
    
    const ct = Synth.AC.currentTime;
    
    const adsrTarget = this.getADSRTarget();
    
    if (this.params.adsrTarget !== 0) {
      this.nodes.adsr.gain.setValueAtTime(1, ct);
    }
    if (this.params.adsrTarget !== 1) {
      this.nodes.filter.frequency.setValueAtTime(this.calcFreqValue(this.params.filterFreq), ct);
    }
    
    const atkDuration = this.params.adsrAttack * Synth.MAX_ADSR_STAGE_DURATION;
    adsrTarget.setValueAtTime(this.getADSRValue(0), ct);
    adsrTarget.linearRampToValueAtTime(this.getADSRValue(1), ct + atkDuration);
    
    const decayDuration = this.params.adsrDecay * Synth.MAX_ADSR_STAGE_DURATION;
    adsrTarget.setTargetAtTime(this.getADSRValue(this.params.adsrSustain), ct + atkDuration, decayDuration);
    
    const width = this.getUnisonWidth(this.params.unisonWidth);
    
    this.oscillators[0] = this.createOscillator(freq, this.params.waveform);
    this.oscillators[1] = this.createOscillator(freq, this.params.waveform, -width);
    this.oscillators[2] = this.createOscillator(freq, this.params.waveform, width);
    
    this.oscillators.forEach((osc) => osc.start(t));
  };
  
  noteOff = (t = 0) => {
    const ct = Synth.AC.currentTime;
    
    const relDuration = this.params.adsrRelease * Synth.MAX_ADSR_STAGE_DURATION;
    this.killOscillators(ct + relDuration);
    
    const adsrTarget = this.getADSRTarget();
    adsrTarget.setValueAtTime(adsrTarget.value, ct);
    adsrTarget.linearRampToValueAtTime(this.getADSRValue(0), ct + relDuration);
  };
    
  killOscillators = (t = 0) => {
    this.nodes.adsr.gain.cancelScheduledValues(t);
    this.nodes.filter.frequency.cancelScheduledValues(t);
    this.oscillators.forEach((osc) => {
      if (osc) osc.stop(t);
    });
  };
    
  createOscillator = (freq, waveform, detune = 0) => {
    const osc = Synth.AC.createOscillator();
    osc.type = Synth.TYPES[waveform];
    osc.frequency.value = freq;
    osc.detune.value = detune;
    osc.connect(this.nodes.adsr);
    return osc;
  };
  
  timePlus = (secs) => {
    return Synth.AC.currentTime + secs;
  };
  
  onStep = (stepIndex, stepStartTime) => {
    const note = this.sequence[stepIndex];
   
    if (note) {
      if (note === 'xxx') {
        this.noteOff(stepStartTime);
      } else {
        this.noteOn(NOTES[note], stepStartTime);
      }
    }
    
    if (this.stepCallback) this.stepCallback(stepIndex);
  };
  
  play = (stepCallback) => {
    this.stepCallback = stepCallback;
        
    sequencerTimer.registerStepCallback(this.onStep);
    this.isPlaying = true;
    sequencerTimer.start();
  };
  
  stop = () => {
    this.isPlaying = false;
    sequencerTimer.stop();
    sequencerTimer.unregisterStepCallback(this.onStep);
    this.noteOff();
  };
}


/** UI **/


const { createContext, useContext, useState, useEffect, useReducer, useRef } = React;

const initialSequencerState = {
  isEditing: false,
  isPlaying: false,
  selectedStepIndex: null,
  playingStepIndex: null
};

const Actions = [
  'SET_PLAY_STATE',
  'SET_EDIT_MODE',
  'SET_SELECTED_STEP',
  'SET_PLAYING_STEP',
  'GO_TO_NEXT_STEP'
].reduce((obj, action) => {
  obj[action] = action;
  return obj;
}, {});

const ActionCreators = {
  setPlayState: (isPlaying) => ({
    type: Actions.SET_PLAY_STATE,
    isPlaying
  }),
  setEditMode: (isEditing) => ({
    type: Actions.SET_EDIT_MODE,
    isEditing
  }),
  setSelectedStep: (selectedStepIndex) => ({
    type: Actions.SET_SELECTED_STEP,
    selectedStepIndex
  }),
  setPlayingStep: (playingStepIndex) => ({
    type: Actions.SET_PLAYING_STEP,
    playingStepIndex
  }),
  goToNextStep: () => ({
    type: Actions.GO_TO_NEXT_STEP
  })
};

const sequencerReducer = (state = initialSequencerState, action = {}) => {
  switch(action.type) {
    case Actions.SET_PLAY_STATE: {
      const { isPlaying } = action;
      return {
        ...state,
        isPlaying,
        playingStepIndex: isPlaying ? state.playingStepIndex: null
      };
    };
      
    case Actions.SET_EDIT_MODE: {
      const { isEditing } = action;
      return {
        ...state,
        isEditing,
        selectedStepIndex: isEditing ? 0 : null
      };
    };
      
    case Actions.SET_SELECTED_STEP: {
      if (!state.isEditing) return state;
      
      const { selectedStepIndex } = action;
      return {
        ...state,
        selectedStepIndex
      };
    }
      
    case Actions.SET_PLAYING_STEP: {
      const { playingStepIndex } = action;
      return {
        ...state,
        playingStepIndex
      };
    }
      
    case Actions.GO_TO_NEXT_STEP: {
      if (state.selectedStepIndex === 15) {
        return {
          ...state,
          selectedStepIndex: null,
          isEditing: false
        };
      }
      
      return {
        ...state,
        selectedStepIndex: state.selectedStepIndex + 1
      };
    }
      
    default: {
      return state;
    }
  }
};

const SynthContext = createContext(null);
const useSynth = () => useContext(SynthContext);

const useSynthParam = (param) => {
  const synth = useSynth();
  const [val, setVal] = useState(synth.params[param]);
  
  const updateParam = (e) => {
    const v = Number(e.target.value);
    setVal(v);
    synth.setParam(param, v);
  };
  
  return [val, updateParam];
};

const SequencerStateContext = createContext(null);
const SequencerStateProvider = ({ children }) => {
  const reducer = useReducer(sequencerReducer, initialSequencerState);
  
  return (
    <SequencerStateContext.Provider value={reducer}>
      {children}
    </SequencerStateContext.Provider>
  );
};
const useSequencerState = () => useContext(SequencerStateContext);


const ControlGroup = ({ label, children }) => (
  <fieldset>
    <legend>{label}</legend>
    {children}
  </fieldset>
);

const GenericSlider = ({ label, belowLabel, ...options }) => {
  return (
    <label className="generic-slider">
      {label && <span class="sidelabel">{label}</span>}
      <div>
        <input type="range" min="0" max="1" step="0.01" {...options} />
        {belowLabel && <span class="sublabel">{belowLabel}</span>}
      </div>
    </label>
  );
};


const PotSlider = ({ param, label, belowLabel }) => {
  const [val, setVal] = useSynthParam(param);
  
  return (
    <GenericSlider label={label} value={val} onInput={setVal} />
  );
};

const SwitchSlider = ({ param, label, belowLabels }) => {
  const [val, setVal] = useSynthParam(param);

  return (
    <GenericSlider 
      label={label}
      belowLabel={belowLabels.join(' - ')}
      value={val}  
      max={belowLabels.length - 1}
      step={1}
      onInput={setVal} 
    />
  )
};

const KeyboardController = ({ notes }) => {
  const synth = useSynth();
  const [state, dispatch] = useSequencerState();
  
  const pressKey = (note) => {
    synth.noteOn(NOTES[note]);
    if (state.isEditing) {
      synth.sequence[state.selectedStepIndex] = note;
      dispatch(ActionCreators.goToNextStep());
    }
  };
  
  const renderKeys = () => notes.map((note) => {
    let cn = note[1] === '#' ? 'sharp' : '';
    cn += (synth.sequence[state.playingStepIndex] === note && state.isPlaying) ? ' active' : '';
    cn += (synth.sequence[state.selectedStepIndex] === note && state.isEditing) ? ' editing' : '';
    
    return (
      <button 
        key={note}
        className={cn}
        onMouseDown={() => pressKey(note)}
        onMouseUp={synth.noteOff}
      >
        <span>{note}</span>
      </button>
    );
  });
  
  return (
    <div className="keyboard">
      {renderKeys()}
    </div>
  );
};

KeyboardController.defaultProps = {
  notes: ['C-3','C#3','D-3','D#3','E-3','F-3','F#3','G-3','G#3','A-3','A#3','B-3','C-4']
};

const ActionButton = ({ label, className = null, onClick = () => {} }) => {
  const synth = useSynth();
  
  return (
    <button 
      className={`button-link action-button ${className}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
};

const PlayButton = () => {
  const [state, dispatch] = useSequencerState();
  const synth = useSynth();
  
  const seqCallback = (stepIndex) => {
    console.log('seqCallback', stepIndex);
    dispatch(ActionCreators.setPlayingStep(stepIndex))
  };
  
  const startSequencer = () => {
    synth.isPlaying ? synth.stop() : synth.play(seqCallback);
    dispatch(ActionCreators.setPlayState(synth.isPlaying));
  };
  
  const cn = `play${state.isPlaying ? ' active' : ''}`
  
  return (
    <ActionButton label="Play/Stop" className={cn} onClick={startSequencer} />
  );
};

const EditButton = () => {
  const [state, dispatch] = useSequencerState();
  
  const toggleEdit = () => {
    dispatch(ActionCreators.setEditMode(!state.isEditing));
  };
  
  const cn = `edit${state.isEditing ? ' active' : ''}`
  
  return (
    <ActionButton label="Edit" className={cn} onClick={toggleEdit} />
  );
};

const RestButton = () => {
  const [state, dispatch] = useSequencerState();
  const synth = useSynth();
  
  const addRest = () => {
    if (state.isEditing) {
      const n = synth.sequence[state.selectedStepIndex];
      synth.sequence[state.selectedStepIndex] = (n === 'xxx') ? null : 'xxx';
      dispatch(ActionCreators.goToNextStep());
    }
  };
  
  return (
    <ActionButton label="Rest" onClick={addRest} />
  )
};

const ClearButton = () => {
  const [state, dispatch] = useSequencerState();
  const synth = useSynth();
  
  return (
    <ActionButton label="Clear" className="clear" />
  );
};

const Sequencer = () => {
  const [state, dispatch] = useSequencerState();
  
  const selectStep = (idx) => {
    dispatch(ActionCreators.setSelectedStep(idx));
  };
  
  const renderSteps = (from, to) => {
    const st = [];
    for (let i = from; i < to; i++) {
      let cn = 'sequencer-step' + (i % 4 === 0 ? ' bar' : '');
      cn += (state.playingStepIndex === i) ? ' playing' : '';
      cn += (state.selectedStepIndex === i) ? ' editing' : '';
      
      st.push(
        <button 
          key={i}
          className={cn}
          onClick={() => selectStep(i)}
        >
          {(i % 4 === 0 ? i / 4 : i % 4) + 1}
        </button>
      );
    }
    return st;
  };
  
  return (
    <div className="sequencer">
      <div className="sequencer-row">
        {renderSteps(0, 8)}
      </div>
      <div className="sequencer-row">
        {renderSteps(8, 16)}
      </div>
    </div>
  );
};

const Visualizer = () => {
  const synth = useSynth();
  const canvasRef = useRef(null)
  
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    const cw = canvasRef.current.width;
    const ch = canvasRef.current.height;
    const chh = Math.round(ch * 0.5);
    ctx.fillStyle = 'red';
    ctx.strokeStyle = 'red';
    
    let canDraw = true;
    
    const draw = () => {
      try {
        if (canDraw) requestAnimationFrame(draw);
        ctx.clearRect(0,0,cw,ch);
        const data = synth.getAnalyserData();

        ctx.beginPath();
        ctx.moveTo(0, chh);
        for(let i = 0, ln = data.length; i < ln; i++) {;
          ctx.lineTo(i, ch * (data[i] / 255));
        }
        ctx.stroke();
      } catch (e) {
        console.log('Ooops', e);
        canDraw = false;
      }
    };
    
    draw();
  }, []);
  
  return (
    <canvas className="visualizer" width="128" height="45" ref={canvasRef} />
  );
};


const SynthUI = ({ synth, label, keyboardNotes }) => (
  <SequencerStateProvider>
    <SynthContext.Provider value={synth}>
      <section>
        <h4>JS-2020{label && <span>&nbsp;- {label}</span>}</h4>

        <div className="row">
          <div className="col">
            <ControlGroup label="Master">
              <PotSlider param="volume" label="Vol" />
            </ControlGroup>

            <ControlGroup label="Voicing">
              <SwitchSlider param="waveform" label="WAV" belowLabels={Synth.TYPES_ABBR} />
              <PotSlider param="unisonWidth" label="WID" /> 
            </ControlGroup>
          </div>

          <ControlGroup label="ADSR">
            <SwitchSlider param="adsrTarget" label="TGT" belowLabels={Synth.ADSR_TARGETS} />
            <PotSlider param="adsrAttack" label="ATK" />
            <PotSlider param="adsrDecay" label="DEC" />
            <PotSlider param="adsrSustain" label="SUS" />
            <PotSlider param="adsrRelease" label="REL" />
          </ControlGroup>

          <div className="col">
            <ControlGroup label="Filter">
              <PotSlider param="filterFreq" label="FRQ" />
              <PotSlider param="filterQ" label="Q" />
            </ControlGroup>

            <ControlGroup label="Echo FX">
              <PotSlider param="echoTime" label="TIM" />
              <PotSlider param="echoFeedback" label="FBK" />
            </ControlGroup>
          </div>
        </div>

        <div className="row">
          <ControlGroup label="Sequencer">
            <div className="row">
              <div className="row sequencer-controls">
                <div className="col">
                  <PlayButton />
                  <ClearButton />
                </div>
                <div className="col">
                  <EditButton />
                  <RestButton />
                </div>
              </div>
              <Sequencer />
            </div>
          </ControlGroup>
        </div>

        <div className="row">
          <KeyboardController notes={keyboardNotes} />
          <ControlGroup label="Visualizer">
            <Visualizer />
          </ControlGroup>
        </div>
      </section>
    </SynthContext.Provider>
  </SequencerStateProvider>
);


const App = () => {
  const synth = new Synth();
  // const synth = new Synth({
  //   waveform: 1,
  //   unisonWidth: 0.6,
  //   adsrTarget: 1,
  //   adsrAttack: 0.05,
  //   adsrDecay: 0.05,
  //   adsrSustain: 0.1,
  //   adsrRelease: 0.2,
  //   filterFreq: 0.3,
  //   filterQ: 0.6
  // });
  
  return (
    <div id="demo" className="slide-basic">
      <SynthUI synth={synth} />
    </div>
  );
};
  

ReactDOM.render(<App />, document.querySelector('#app'));