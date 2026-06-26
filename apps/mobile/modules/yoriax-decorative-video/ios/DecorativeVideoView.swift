import ExpoModulesCore
import AVFoundation

/// A purely decorative video view that renders looping muted video using AVPlayerLayer.
/// This view NEVER touches AVAudioSession, ensuring zero interference with the music player.
class DecorativeVideoView: ExpoView {
  private var player: AVQueuePlayer?
  private var playerLayer: AVPlayerLayer?
  private var looper: AVPlayerLooper?
  private var statusObservation: NSKeyValueObservation?
  private var foregroundObserver: NSObjectProtocol?
  private var backgroundObserver: NSObjectProtocol?
  private var isActive: Bool = true
  private var wasPlayingBeforeBackground: Bool = false

  // MARK: - Props

  var source: String? = nil {
    didSet {
      guard source != oldValue else { return }
      loadSource()
    }
  }

  var active: Bool = true {
    didSet {
      guard active != oldValue else { return }
      isActive = active
      if active {
        player?.play()
      } else {
        player?.pause()
      }
    }
  }

  var contentFit: String = "cover" {
    didSet {
      guard contentFit != oldValue else { return }
      updateContentFit()
    }
  }

  // MARK: - Lifecycle

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    clipsToBounds = true
    setupAppLifecycleObservers()
  }

  deinit {
    teardown()
    if let foregroundObserver { NotificationCenter.default.removeObserver(foregroundObserver) }
    if let backgroundObserver { NotificationCenter.default.removeObserver(backgroundObserver) }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    playerLayer?.frame = bounds
  }

  // MARK: - Source Loading

  private func loadSource() {
    teardown()

    guard let source, !source.isEmpty else { return }

    let url: URL?
    if source.hasPrefix("http://") || source.hasPrefix("https://") {
      url = URL(string: source)
    } else {
      // Support local file paths (e.g. from require() resolved asset URIs)
      url = URL(fileURLWithPath: source)
    }

    guard let videoURL = url else {
      print("[DecorativeVideo] Invalid source URL: \(source)")
      return
    }

    let asset = AVAsset(url: videoURL)
    let templateItem = AVPlayerItem(asset: asset)
    let queuePlayer = AVQueuePlayer(playerItem: templateItem)

    // CRITICAL: Always muted. Never touch AVAudioSession.
    queuePlayer.isMuted = true
    queuePlayer.volume = 0
    queuePlayer.preventsDisplaySleepDuringVideoPlayback = false

    // Seamless looping via AVPlayerLooper
    let playerLooper = AVPlayerLooper(player: queuePlayer, templateItem: templateItem)

    // Create the rendering layer
    let layer = AVPlayerLayer(player: queuePlayer)
    updateLayerGravity(layer)
    layer.frame = bounds
    self.layer.addSublayer(layer)

    // Track readiness
    statusObservation = templateItem.observe(\.status, options: [.new]) { [weak self] item, _ in
      if item.status == .readyToPlay {
        DispatchQueue.main.async {
          // Re-ensure muted state after loading
          self?.player?.isMuted = true
          self?.player?.volume = 0
          if self?.isActive == true {
            self?.player?.play()
          }
        }
      }
    }

    player = queuePlayer
    playerLayer = layer
    looper = playerLooper

    if isActive {
      queuePlayer.play()
    }
  }

  // MARK: - Content Fit

  private func updateContentFit() {
    if let playerLayer {
      updateLayerGravity(playerLayer)
    }
  }

  private func updateLayerGravity(_ layer: AVPlayerLayer) {
    switch contentFit {
    case "contain":
      layer.videoGravity = .resizeAspect
    case "fill":
      layer.videoGravity = .resize
    default: // "cover"
      layer.videoGravity = .resizeAspectFill
    }
  }

  // MARK: - App Lifecycle

  private func setupAppLifecycleObservers() {
    foregroundObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.willEnterForegroundNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      guard let self, self.isActive, self.wasPlayingBeforeBackground else { return }
      self.player?.isMuted = true
      self.player?.volume = 0
      self.player?.play()
    }

    backgroundObserver = NotificationCenter.default.addObserver(
      forName: UIApplication.didEnterBackgroundNotification,
      object: nil,
      queue: .main
    ) { [weak self] _ in
      guard let self else { return }
      self.wasPlayingBeforeBackground = self.player?.rate != 0
      self.player?.pause()
    }
  }

  // MARK: - Teardown

  private func teardown() {
    statusObservation?.invalidate()
    statusObservation = nil
    player?.pause()
    playerLayer?.removeFromSuperlayer()
    looper = nil
    player = nil
    playerLayer = nil
  }
}
