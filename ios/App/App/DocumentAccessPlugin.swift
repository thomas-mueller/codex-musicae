// UNVERIFIED(ios): written without a Mac or Xcode; only the ios-compile CI job builds it (docs/ios-unverified.md).
import Capacitor
import UIKit
import UniformTypeIdentifiers

/// Files app access for PDFs (PLT-013): opens documents in place with security-scoped bookmarks, reads and writes them in chunks,
/// creates documents for "save a copy" and queues files handed over by "Open in…". Same JS API and error codes as the Android
/// plugin. Only bookmarks (id -> reference) are stored, in this plugin's own defaults suite; never PDF bytes.
@objc(DocumentAccessPlugin)
public class DocumentAccessPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate {
    public let identifier = "DocumentAccessPlugin"
    public let jsName = "DocumentAccess"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(#selector(pickDocuments(_:)), returnType: .promise),
        CAPPluginMethod(#selector(openRead(_:)), returnType: .promise),
        CAPPluginMethod(#selector(readChunk(_:)), returnType: .promise),
        CAPPluginMethod(#selector(closeRead(_:)), returnType: .promise),
        CAPPluginMethod(#selector(openWrite(_:)), returnType: .promise),
        CAPPluginMethod(#selector(writeChunk(_:)), returnType: .promise),
        CAPPluginMethod(#selector(commitWrite(_:)), returnType: .promise),
        CAPPluginMethod(#selector(abortWrite(_:)), returnType: .promise),
        CAPPluginMethod(#selector(createDocument(_:)), returnType: .promise),
        CAPPluginMethod(#selector(isPersisted(_:)), returnType: .promise),
        CAPPluginMethod(#selector(forget(_:)), returnType: .promise),
        CAPPluginMethod(#selector(getPendingIncoming(_:)), returnType: .promise)
    ]

    private enum Names {
        static let suite = "cm-document-access"
        static let bookmarkPrefix = "bookmark:"
        static let writePrefix = "cm-write-"
        static let defaultName = "document.pdf"
        static let incomingEvent = "incomingFile"
        static let copyBufferBytes = 64 * 1024
        static let millisecondsPerSecond = 1000.0
    }

    /// The error codes of the web side's `FileAccessError`.
    private enum Failure: Error {
        case notFound, denied, readFailed, writeFailed

        var code: String {
            switch self {
            case .notFound: return "not-found"
            case .denied: return "denied"
            case .readFailed: return "read-failed"
            case .writeFailed: return "write-failed"
            }
        }
    }

    /// A resolved file whose security scope is open until `end()`.
    private struct Scope {
        let url: URL
        let scoped: Bool

        func end() {
            if scoped {
                url.stopAccessingSecurityScopedResource()
            }
        }
    }

    private struct Reader {
        let handle: FileHandle
        let scope: Scope
    }

    private struct Writer {
        let id: String
        let temp: URL
        let handle: FileHandle
    }

    private enum Picking {
        case open
        case create(directory: URL)
    }

    static weak var instance: DocumentAccessPlugin?
    private static var pendingIncoming: [[String: Any]] = []
    private static let pendingLock = NSLock()

    private let lock = NSLock()
    private var readers: [String: Reader] = [:]
    private var writers: [String: Writer] = [:]
    private var picking: (call: CAPPluginCall, mode: Picking)?

    // MARK: picking

    @objc func pickDocuments(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.pdf], asCopy: false)
            picker.allowsMultipleSelection = call.getBool("multiple", true)
            self.present(picker, for: call, mode: .open)
        }
    }

    /// Main thread only.
    private func present(_ picker: UIDocumentPickerViewController, for call: CAPPluginCall, mode: Picking) {
        guard let presenter = bridge?.viewController else {
            call.reject(Failure.readFailed.code, Failure.readFailed.code)
            return
        }
        picking = (call, mode)
        picker.delegate = self
        presenter.present(picker, animated: true)
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let state = picking else { return }
        picking = nil
        switch state.mode {
        case .open:
            var files: [[String: Any]] = []
            for url in urls {
                let scoped = url.startAccessingSecurityScopedResource()
                defer {
                    if scoped {
                        url.stopAccessingSecurityScopedResource()
                    }
                }
                guard let id = DocumentAccessPlugin.remember(url) else {
                    state.call.reject(Failure.denied.code, Failure.denied.code)
                    return
                }
                files.append(DocumentAccessPlugin.describe(id: id, url: url, writable: DocumentAccessPlugin.isWritable(url)))
            }
            state.call.resolve(["files": files])
        case .create(let directory):
            defer { try? FileManager.default.removeItem(at: directory) }
            guard let url = urls.first else {
                state.call.resolve()
                return
            }
            let scoped = url.startAccessingSecurityScopedResource()
            defer {
                if scoped {
                    url.stopAccessingSecurityScopedResource()
                }
            }
            if let id = DocumentAccessPlugin.remember(url) {
                state.call.resolve(["id": id])
            } else {
                state.call.reject(Failure.denied.code, Failure.denied.code)
            }
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        guard let state = picking else { return }
        picking = nil
        if case .create(let directory) = state.mode {
            try? FileManager.default.removeItem(at: directory)
        }
        // An empty result means the user cancelled (`files: []`, or no `id`).
        switch state.mode {
        case .open: state.call.resolve(["files": [[String: Any]]()])
        case .create: state.call.resolve()
        }
    }

    // MARK: reading

    @objc func openRead(_ call: CAPPluginCall) {
        let scope: Scope
        do {
            scope = try DocumentAccessPlugin.begin(call.getString("id"))
        } catch {
            reject(call, error, fallback: .readFailed)
            return
        }
        do {
            let handle = try FileHandle(forReadingFrom: scope.url)
            let size = try handle.seekToEnd()
            let key = UUID().uuidString
            lock.lock()
            readers[key] = Reader(handle: handle, scope: scope)
            lock.unlock()
            call.resolve(["handle": key, "size": size, "writable": DocumentAccessPlugin.isWritable(scope.url)])
        } catch {
            scope.end()
            reject(call, Failure.notFound, fallback: .readFailed)
        }
    }

    @objc func readChunk(_ call: CAPPluginCall) {
        guard let key = call.getString("handle"), let reader = reader(key),
              let offset = call.getInt("offset"), let length = call.getInt("length"), offset >= 0, length >= 0 else {
            reject(call, Failure.readFailed, fallback: .readFailed)
            return
        }
        do {
            try reader.handle.seek(toOffset: UInt64(offset))
            let data = try reader.handle.read(upToCount: length) ?? Data()
            call.resolve(["data": data.base64EncodedString()])
        } catch {
            reject(call, Failure.readFailed, fallback: .readFailed)
        }
    }

    @objc func closeRead(_ call: CAPPluginCall) {
        lock.lock()
        let reader = call.getString("handle").flatMap { readers.removeValue(forKey: $0) }
        lock.unlock()
        if let reader = reader {
            try? reader.handle.close()
            reader.scope.end()
        }
        call.resolve()
    }

    // MARK: writing

    @objc func openWrite(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), DocumentAccessPlugin.store.data(forKey: Names.bookmarkPrefix + id) != nil else {
            reject(call, Failure.notFound, fallback: .writeFailed)
            return
        }
        let temp = FileManager.default.temporaryDirectory.appendingPathComponent(Names.writePrefix + UUID().uuidString)
        do {
            guard FileManager.default.createFile(atPath: temp.path, contents: nil) else { throw Failure.writeFailed }
            let handle = try FileHandle(forWritingTo: temp)
            let key = UUID().uuidString
            lock.lock()
            writers[key] = Writer(id: id, temp: temp, handle: handle)
            lock.unlock()
            call.resolve(["handle": key])
        } catch {
            reject(call, error, fallback: .writeFailed)
        }
    }

    @objc func writeChunk(_ call: CAPPluginCall) {
        guard let key = call.getString("handle"), let writer = writer(key),
              let encoded = call.getString("data"), let data = Data(base64Encoded: encoded) else {
            reject(call, Failure.writeFailed, fallback: .writeFailed)
            return
        }
        do {
            try writer.handle.write(contentsOf: data)
            call.resolve()
        } catch {
            reject(call, Failure.writeFailed, fallback: .writeFailed)
        }
    }

    /// The target is only touched once the complete new content is in the temp file; then one coordinated replace (LIM-011).
    @objc func commitWrite(_ call: CAPPluginCall) {
        guard let key = call.getString("handle"), let writer = takeWriter(key) else {
            reject(call, Failure.writeFailed, fallback: .writeFailed)
            return
        }
        defer { try? FileManager.default.removeItem(at: writer.temp) }
        try? writer.handle.close()
        let scope: Scope
        do {
            scope = try DocumentAccessPlugin.begin(writer.id)
        } catch {
            reject(call, error, fallback: .writeFailed)
            return
        }
        defer { scope.end() }
        var coordinationError: NSError?
        var failure: Error?
        NSFileCoordinator(filePresenter: nil).coordinate(writingItemAt: scope.url, options: .forReplacing, error: &coordinationError) { target in
            do {
                _ = try FileManager.default.replaceItemAt(target, withItemAt: writer.temp)
            } catch {
                // Some providers refuse a replace; copying over the existing item still happens inside the coordination.
                do {
                    try DocumentAccessPlugin.copyContents(from: writer.temp, to: target)
                } catch {
                    failure = error
                }
            }
        }
        if coordinationError != nil || failure != nil {
            reject(call, Failure.writeFailed, fallback: .writeFailed)
        } else {
            call.resolve()
        }
    }

    @objc func abortWrite(_ call: CAPPluginCall) {
        if let key = call.getString("handle"), let writer = takeWriter(key) {
            try? writer.handle.close()
            try? FileManager.default.removeItem(at: writer.temp)
        }
        call.resolve()
    }

    // MARK: save a copy

    /// The web side writes after `createDocument`, but the export picker needs a file up front: it exports an empty one and the
    /// following `commitWrite` fills the destination it returns.
    @objc func createDocument(_ call: CAPPluginCall) {
        let name = (call.getString("name", Names.defaultName) as NSString).lastPathComponent
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        let empty = directory.appendingPathComponent(name)
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            guard FileManager.default.createFile(atPath: empty.path, contents: Data()) else { throw Failure.writeFailed }
        } catch {
            reject(call, error, fallback: .writeFailed)
            return
        }
        DispatchQueue.main.async {
            let picker = UIDocumentPickerViewController(forExporting: [empty], asCopy: true)
            self.present(picker, for: call, mode: .create(directory: directory))
        }
    }

    // MARK: references

    @objc func isPersisted(_ call: CAPPluginCall) {
        var persisted = false
        if let id = call.getString("id"), let data = DocumentAccessPlugin.store.data(forKey: Names.bookmarkPrefix + id) {
            var stale = false
            persisted = (try? URL(resolvingBookmarkData: data, options: [], relativeTo: nil, bookmarkDataIsStale: &stale)) != nil
        }
        call.resolve(["persisted": persisted])
    }

    @objc func forget(_ call: CAPPluginCall) {
        if let id = call.getString("id") {
            DocumentAccessPlugin.store.removeObject(forKey: Names.bookmarkPrefix + id)
        }
        call.resolve()
    }

    /// Returns the files queued by "Open in…" and empties the queue.
    @objc func getPendingIncoming(_ call: CAPPluginCall) {
        DocumentAccessPlugin.pendingLock.lock()
        let files = DocumentAccessPlugin.pendingIncoming
        DocumentAccessPlugin.pendingIncoming.removeAll()
        DocumentAccessPlugin.pendingLock.unlock()
        call.resolve(["files": files])
    }

    // MARK: "Open in…"

    /// Called by `AppDelegate` for every URL the system hands to the app. The web side answers the `incomingFile` ping by calling
    /// `getPendingIncoming`; a file queued before the page listens is picked up at startup.
    @objc public static func handleIncoming(url: URL) {
        guard url.isFileURL else { return }
        let scoped = url.startAccessingSecurityScopedResource()
        defer {
            if scoped {
                url.stopAccessingSecurityScopedResource()
            }
        }
        guard let id = remember(url) else { return }
        let file = describe(id: id, url: url, writable: isWritable(url))
        pendingLock.lock()
        pendingIncoming.append(file)
        pendingLock.unlock()
        instance?.notifyListeners(Names.incomingEvent, data: [:])
    }

    // MARK: helpers

    private static var store: UserDefaults {
        return UserDefaults(suiteName: Names.suite) ?? UserDefaults.standard
    }

    /// The id of the bookmark for `url` (an existing one when the same file was seen before); nil when no bookmark can be made.
    private static func remember(_ url: URL) -> String? {
        let path = url.standardizedFileURL.path
        for (key, value) in store.dictionaryRepresentation() where key.hasPrefix(Names.bookmarkPrefix) {
            guard let data = value as? Data else { continue }
            var stale = false
            if let known = try? URL(resolvingBookmarkData: data, options: [], relativeTo: nil, bookmarkDataIsStale: &stale),
               known.standardizedFileURL.path == path {
                return String(key.dropFirst(Names.bookmarkPrefix.count))
            }
        }
        guard let data = try? url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) else { return nil }
        let id = UUID().uuidString
        store.set(data, forKey: Names.bookmarkPrefix + id)
        return id
    }

    /// Resolves the bookmark and opens its security scope. Unknown id or unresolvable bookmark: not-found; a scope that cannot be
    /// opened for a file that is not readable: denied.
    private static func begin(_ id: String?) throws -> Scope {
        guard let id = id, let data = store.data(forKey: Names.bookmarkPrefix + id) else { throw Failure.notFound }
        var stale = false
        let url: URL
        do {
            url = try URL(resolvingBookmarkData: data, options: [], relativeTo: nil, bookmarkDataIsStale: &stale)
        } catch {
            throw Failure.notFound
        }
        let scoped = url.startAccessingSecurityScopedResource()
        if !scoped && !FileManager.default.isReadableFile(atPath: url.path) {
            throw Failure.denied
        }
        if stale, let fresh = try? url.bookmarkData(options: [], includingResourceValuesForKeys: nil, relativeTo: nil) {
            store.set(fresh, forKey: Names.bookmarkPrefix + id)
        }
        return Scope(url: url, scoped: scoped)
    }

    /// Non-destructive write probe: asks the file system, never opens the file for writing.
    private static func isWritable(_ url: URL) -> Bool {
        return (try? url.resourceValues(forKeys: [.isWritableKey]))?.isWritable ?? false
    }

    private static func describe(id: String, url: URL, writable: Bool) -> [String: Any] {
        var file: [String: Any] = ["id": id, "name": url.lastPathComponent, "writable": writable]
        if let values = try? url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey]) {
            if let size = values.fileSize {
                file["size"] = size
            }
            if let modified = values.contentModificationDate {
                file["lastModified"] = Int64(modified.timeIntervalSince1970 * Names.millisecondsPerSecond)
            }
        }
        return file
    }

    private static func copyContents(from source: URL, to target: URL) throws {
        let input = try FileHandle(forReadingFrom: source)
        defer { try? input.close() }
        let output = try FileHandle(forWritingTo: target)
        defer { try? output.close() }
        try output.truncate(atOffset: 0)
        while let chunk = try input.read(upToCount: Names.copyBufferBytes), !chunk.isEmpty {
            try output.write(contentsOf: chunk)
        }
    }

    private func reject(_ call: CAPPluginCall, _ error: Error, fallback: Failure) {
        let failure = (error as? Failure) ?? fallback
        call.reject(failure.code, failure.code)
    }

    private func reader(_ key: String) -> Reader? {
        lock.lock()
        defer { lock.unlock() }
        return readers[key]
    }

    private func writer(_ key: String) -> Writer? {
        lock.lock()
        defer { lock.unlock() }
        return writers[key]
    }

    private func takeWriter(_ key: String) -> Writer? {
        lock.lock()
        defer { lock.unlock() }
        return writers.removeValue(forKey: key)
    }
}
