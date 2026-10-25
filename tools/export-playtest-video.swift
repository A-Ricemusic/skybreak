// Export a native Studio window recording as a cropped, real-time MP4.
// swift tools/export-playtest-video.swift input.mov output.mp4 x y width height
// Crop coordinates are source-video pixels, measured from the upper-left.
import Foundation
import AVFoundation

@main struct ExportPlaytest {
    static func main() async throws {
        let args = CommandLine.arguments
        guard args.count == 7,
              let x = Double(args[3]), let y = Double(args[4]),
              let width = Double(args[5]), let height = Double(args[6]),
              x >= 0, y >= 0, width > 0, height > 0 else {
            throw NSError(domain: "SkybreakVideo", code: 1, userInfo: [NSLocalizedDescriptionKey: "Expected input.mov output.mp4 x y width height"])
        }
        let asset = AVURLAsset(url: URL(fileURLWithPath: args[1]))
        let tracks = try await asset.loadTracks(withMediaType: .video)
        guard let track = tracks.first else { throw NSError(domain: "SkybreakVideo", code: 2) }
        let size = try await track.load(.naturalSize)
        let duration = try await asset.load(.duration)
        guard x + width <= size.width, y + height <= size.height else {
            throw NSError(domain: "SkybreakVideo", code: 3, userInfo: [NSLocalizedDescriptionKey: "Crop exceeds video bounds \(size)"])
        }
        let composition = AVMutableVideoComposition()
        composition.renderSize = CGSize(width: width, height: height)
        composition.frameDuration = CMTime(value: 1, timescale: 30)
        let instruction = AVMutableVideoCompositionInstruction()
        instruction.timeRange = CMTimeRange(start: .zero, duration: duration)
        let layer = AVMutableVideoCompositionLayerInstruction(assetTrack: track)
        layer.setTransform(CGAffineTransform(translationX: -x, y: -y), at: .zero)
        instruction.layerInstructions = [layer]
        composition.instructions = [instruction]
        guard let exporter = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetHighestQuality) else {
            throw NSError(domain: "SkybreakVideo", code: 4)
        }
        let destination = URL(fileURLWithPath: args[2])
        guard !FileManager.default.fileExists(atPath: destination.path) else {
            throw NSError(domain: "SkybreakVideo", code: 5, userInfo: [NSLocalizedDescriptionKey: "Output already exists"])
        }
        exporter.videoComposition = composition
        exporter.shouldOptimizeForNetworkUse = true
        try await exporter.export(to: destination, as: .mp4)
        let result = AVURLAsset(url: destination)
        let finalDuration = try await result.load(.duration)
        guard abs(finalDuration.seconds - duration.seconds) < 0.15 else {
            throw NSError(domain: "SkybreakVideo", code: 6, userInfo: [NSLocalizedDescriptionKey: "Unexpected duration change"])
        }
        print("Exported \(destination.path): \(width)x\(height), \(finalDuration.seconds)s, real-time")
    }
}
