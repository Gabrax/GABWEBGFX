import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";
import "https://cdnjs.cloudflare.com/ajax/libs/simplex-noise/2.3.0/simplex-noise.min.js";

const vertexShader = `
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = `
    varying vec2 vUv;
    uniform vec3 colorStart;
    uniform vec3 colorEnd;
    void main() {
        gl_FragColor = vec4(mix(colorStart, colorEnd, vUv.y), 1.0);
    }
`;

interface Song
{
  path: string;
  displayName: string;
  cover?: string;
  artist?: string;
}

export class MusicVisualizerPlayer
{
  private audio: HTMLAudioElement = new Audio();
  private ctx!: AudioContext;
  private analyser!: AnalyserNode;
  private data!: Uint8Array;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private sphere!: THREE.Mesh;

  private tracks: Song[] =
  [
    {
      path: '/Music/Nujabes-Nowayback.mp3', 
      displayName: 'No way back',
      cover: '/Music/nujabes-departure.jpg',
      artist: 'Nujabes'
    },
    {
      path: '/Music/[dko]-fnk.mp3',
      displayName: '[dko] - fnk',
      cover: '/Music/dko-fnk.png',
      artist: 'Lush Loops'
    },
    {
      path: '/Music/ODESZA-WeWereYoung.mp3',
      displayName: 'We Were Young',
      cover: '/Music/odesza-wewereyoung.png',
      artist: 'ODESZA'
    }
  ];
  private index: number = 0;
  private isPlaying: boolean = false;

  private playBtn!: HTMLElement;
  private prevBtn!: HTMLElement;
  private nextBtn!: HTMLElement;
  private volumeInput!: HTMLInputElement;
  private progress!: HTMLElement;
  private playerProgress!: HTMLElement;
  private title!: HTMLElement;
  private artist!: HTMLElement;
  private cover!: HTMLImageElement;
  private currentTimeEL!: HTMLElement;
  private durationEL!: HTMLElement;

  private noise = new SimplexNoise();

  constructor(private renderer: THREE.WebGLRenderer)
  {
    this.playBtn = document.getElementById('play')!;
    this.prevBtn = document.getElementById('prev')!;
    this.nextBtn = document.getElementById('next')!;
    this.volumeInput = document.getElementById('volumeControl') as HTMLInputElement;
    this.progress = document.getElementById('progress')!;
    this.playerProgress = document.getElementById('player-progress')!;
    this.title = document.getElementById('title')!;
    this.artist = document.getElementById('artist')!;
    this.cover = document.getElementById('cover') as HTMLImageElement;
    this.currentTimeEL = document.getElementById('curr-time')!;
    this.durationEL = document.getElementById('duration')!;

    this.audio.src = this.tracks[this.index].path;
    this.audio.volume = 0.5;

    this.initAudio();
    this.initThree();
    this.initDragAndDrop();
    this.bindUI();
    this.loadTrack(this.index);
  }

  destroy()
  {
    this.audio.pause();
    this.audio.src = "";

    if (this.analyser) this.analyser.disconnect();

    if (this.ctx && this.ctx.state !== "closed") {
      this.ctx.close();
    }
  }

  private initAudio()
  {
    this.ctx = new AudioContext();
    const src = this.ctx.createMediaElementSource(this.audio);
    this.analyser = this.ctx.createAnalyser();
    src.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.analyser.fftSize = 512;
    this.data = new Uint8Array(this.analyser.frequencyBinCount);
  }

  private initThree()
  {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.z = 80;

    const geometry = new THREE.IcosahedronGeometry(20, 3);
    const material = new THREE.ShaderMaterial
    ({
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      uniforms:
      {
        colorStart: { value: new THREE.Color("#ff0000") }, // Start color
        colorEnd: { value: new THREE.Color("#00ff00") }   // End color
      }
    });
    this.sphere = new THREE.Mesh(geometry, material);
    this.scene.add(this.sphere);

    const light = new THREE.DirectionalLight(0xffffff, 0.8);
    light.position.set(0, 50, 100);
    this.scene.add(light);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  }

  private initDragAndDrop() {
    const dropZone = document.getElementById('drop-zone')!;
    
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('hover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('hover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('hover');

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      if (!file.type.startsWith('audio')) {
        alert('Please drop a valid audio file');
        return;
      }

      const audioUrl = URL.createObjectURL(file);

      this.addAndPlaySong({
        path: audioUrl,
        displayName: file.name.replace(/\.[^/.]+$/, ''),
        cover: '/Music/itunes_icon.jpg',
        artist: 'Local file'
      });
    });

    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());
  }

  private bindUI()
  {
    this.playBtn.addEventListener('click', () => this.togglePlay());
    this.prevBtn.addEventListener('click', () => this.changeTrack(-1));
    this.nextBtn.addEventListener('click', () => this.changeTrack(1));
    this.volumeInput.addEventListener('input', e => this.audio.volume = (e.target as HTMLInputElement).valueAsNumber / 100);
    this.audio.addEventListener('timeupdate', () => this.updateProgressBar());
    this.audio.addEventListener('ended', () => this.changeTrack(1));
    this.playerProgress.addEventListener('click', (e) => this.setProgressBar(e));
  }

  private togglePlay()
  {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.audio.paused) {
      this.audio.play();
      this.isPlaying = true;
      this.playBtn.classList.replace('fa-play','fa-pause');
    } else {
      this.audio.pause();
      this.isPlaying = false;
      this. playBtn.classList.replace('fa-pause','fa-play');
    }
  }

  public addAndPlaySong(song: Song)
  {
    this.tracks.push(song);
    this.index = this.tracks.length - 1;
    this.loadTrack(this.index);
    this.audio.play();
    this.isPlaying = true;
    this.playBtn.classList.replace('fa-play','fa-pause');
  }

  private changeTrack(dir: number)
  {
    this.index = (this.index + dir + this.tracks.length) % this.tracks.length;
    this.loadTrack(this.index);
    this.audio.play();
    this.isPlaying = true;
    this.playBtn.classList.replace('fa-play','fa-pause');
  }

  private loadTrack(index: number)
  {
    const track = this.tracks[index];
    this.audio.src = track.path;
    this.title.textContent = track.displayName;
    this.artist.textContent = track.artist;
    this.cover.src = track.cover;
  }

  private updateProgressBar()
  {
    const { duration, currentTime } = this.audio;
    const progressPercent = (currentTime / duration) * 100 || 0;
    this.progress.style.width = `${progressPercent}%`;

    const formatTime = (time: number) => String(Math.floor(time)).padStart(2, '0');
    this.durationEL.textContent = `${formatTime(duration / 60)}:${formatTime(duration % 60)}`;
    this.currentTimeEL.textContent = `${formatTime(currentTime / 60)}:${formatTime(currentTime % 60)}`;
  }

  private setProgressBar(e: MouseEvent)
  {
    const width = this.playerProgress.clientWidth;
    const clickX = e.offsetX;
    this.audio.currentTime = (clickX / width) * this.audio.duration;
  }

  public update(time: number)
  {
    this.analyser.getByteFrequencyData(this.data);

    const lowerHalf = this.data.slice(0, this.data.length / 2);
    const upperHalf = this.data.slice(this.data.length / 2);

    const bass = Math.max(...lowerHalf) / 255;
    const treble = upperHalf.reduce((a, b) => a + b, 0) / upperHalf.length / 255;

    this.warpSphere(this.sphere, bass, treble);

    this.sphere.rotation.x += 0.001;
    this.sphere.rotation.y += 0.003;
    this.sphere.rotation.z += 0.005;

    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
  }

  private warpSphere(mesh: THREE.Mesh, bass: number, treble: number)
  {
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const noise = this.noise;

    if (!pos) return;

    for (let i = 0; i < pos.count; i++)
    {
      let x = pos.getX(i);
      let y = pos.getY(i);
      let z = pos.getZ(i);

      const len = Math.sqrt(x*x + y*y + z*z) || 1;
      x /= len;
      y /= len;
      z /= len;

      const offset = 20;
      const amp = 5;
      const time = window.performance.now();
      const rf = 0.00001;

      const distance = offset + bass + noise.noise3D(
          x + time*rf*4,
          y + time*rf*6,
          z + time*rf*7
      ) * amp * treble * 2;

      pos.setXYZ(i, x*distance, y*distance, z*distance);
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals();
  }
}
