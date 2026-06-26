import ExpoModulesCore
import AVFoundation
import CryptoKit
import Foundation

private final class DecorativeVideoRemoteCache {
  static let shared = DecorativeVideoRemoteCache()

  private let fileManager = FileManager.default
  private let queue = DispatchQueue(label: "com.yoriax.decorative-video-cache")
  private var inFlightSources = Set<String>()

  private lazy var cacheDirectory: URL = {
    let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
    return caches.appendingPathComponent("YoriaxDecorativeVideoCache", isDirectory: true)
  }()

  func cachedPlaybackURL(for source: String, remoteURL: URL) -> URL? {
    let fileURL = cacheFileURL(for: source, remoteURL: remoteURL)
    return fileManager.fileExists(atPath: fileURL.path) ? fileURL : nil
  }

  func warmRemoteVideo(source: String, remoteURL: URL) {
    queue.async { [weak self] in
      guard let self else { return }

      let fileURL = self.cacheFileURL(for: source, remoteURL: remoteURL)
      if self.fileManager.fileExists(atPath: fileURL.path) || self.inFlightSources.contains(source) {
        return
      }

      self.inFlightSources.insert(source)
      do {
        try self.fileManager.createDirectory(at: self.cacheDirectory, withIntermediateDirectories: true)
      } catch {
        self.inFlightSources.remove(source)
        return
      }

      URLSession.shared.downloadTask(with: remoteURL) { [weak self] temporaryURL, _, error in
        self?.queue.async {
          guard let self else { return }
          defer { self.inFlightSources.remove(source) }
          guard error == nil, let temporaryURL else { return }

          do {
            if self.fileManager.fileExists(atPath: fileURL.path) {
              try self.fileManager.removeItem(at: fileURL)
            }
            try self.fileManager.moveItem(at: temporaryURL, to: fileURL)
          } catch {
            try? self.fileManager.removeItem(at: temporaryURL)
          }
        }
      }.resume()
    }
  }

  private func cacheFileURL(for source: String, remoteURL: URL) -> URL {
    let digest = SHA256.hash(data: Data(source.utf8))
      .map { String(format: "%02x", $0) }
      .joined()
    let pathExtension = normalizedExtension(remoteURL.pathExtension)
    return cacheDirectory.appendingPathComponent("\(digest).\(pathExtension)")
  }

  private func normalizedExtension(_ pathExtension: String) -> String {
    let normalized = pathExtension
      .lowercased()
      .filter { $0.isLetter || $0.isNumber }

    return normalized.isEmpty ? "mov" : String(normalized)
  }
}

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
    if let remoteURL = Self.remoteURL(from: source) {
      if let cachedURL = DecorativeVideoRemoteCache.shared.cachedPlaybackURL(for: source, remoteURL: remoteURL) {
        url = cachedURL
      } else {
        url = remoteURL
        DecorativeVideoRemoteCache.shared.warmRemoteVideo(source: source, remoteURL: remoteURL)
      }
    } else {
      url = Self.localURL(from: source)
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

  private static func remoteURL(from source: String) -> URL? {
    guard let url = URL(string: source) else { return nil }
    let scheme = url.scheme?.lowercased()
    return scheme == "http" || scheme == "https" ? url : nil
  }

  private static func localURL(from source: String) -> URL? {
    if let url = URL(string: source), url.isFileURL {
      return url
    }

    return URL(fileURLWithPath: source)
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
