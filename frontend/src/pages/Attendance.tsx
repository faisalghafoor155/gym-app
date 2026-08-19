import { useEffect, useState, useRef, useCallback } from 'react';
import { Search, CheckCircle2, Clock, Users, CalendarCheck, UserX, QrCode, ScanLine, X, Fingerprint, AlertCircle } from 'lucide-react';
import {
  Page, PageHeader, Card, PageLoader, inputClass, focusRing, SegmentedControl,
} from '../components/ui';
import api, { apiError } from '../api/client';
import type {
  Member, AttendanceRecord, CheckinResult, Paginated,
  FingerprintStatus, FingerprintIdentifyResult,
} from '../types';
import toast from 'react-hot-toast';
import { Html5Qrcode } from 'html5-qrcode';

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/** Plays a short, pleasant beep tone using the Web Audio API. */
function playBeep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.3;
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Silently fail — audio is a nicety, not a necessity.
  }
}

type TabType = 'search' | 'scanner' | 'fingerprint';

export default function Attendance() {
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [todayList, setTodayList] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null);

  // QR Scanner state
  const [scannerActive, setScannerActive] = useState(false);
  const [lastScanned, setLastScanned] = useState<{ name: string; photo?: string | null; status: string } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cooldownRef = useRef(false);

  // Fingerprint state
  const [fpStatus, setFpStatus] = useState<FingerprintStatus | null>(null);
  const [fpScanning, setFpScanning] = useState(false);
  const [fpMessage, setFpMessage] = useState<string | null>(null);

  const loadToday = () =>
    api.get<AttendanceRecord[]>('/attendance/today').then(r => setTodayList(r.data));

  useEffect(() => {
    Promise.all([
      api.get<Paginated<Member>>('/members?all=true').then(r => setMembers(r.data.data)),
      loadToday(),
      // Whether there is a reader at all. Failing quietly is right: the tab
      // renders as "not set up", which is the same thing the endpoint would
      // have said, and a gym with no reader should not get an error toast on
      // every visit to a page it uses all day.
      api.get<FingerprintStatus>('/fingerprint/status')
        .then(r => setFpStatus(r.data))
        .catch(() => setFpStatus(null)),
    ])
      .catch(err => toast.error(apiError(err, 'Could not load attendance')))
      .finally(() => setLoading(false));
  }, []);

  const filtered = search.trim().length > 0
    ? members.filter(m =>
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.phone && m.phone.includes(search))
      )
    : [];

  const checkedInIds = new Set(todayList.map(r => r.memberId));

  const handleCheckin = async (member: Member) => {
    if (checkedInIds.has(member.id)) {
      toast('Already checked in today', { icon: 'ℹ️' });
      return;
    }
    setChecking(member.id);
    try {
      const { data } = await api.post<CheckinResult>(
        '/attendance/checkin', { memberId: member.id },
      );

      if (data.alreadyCheckedIn) {
        toast(`${member.name} was already checked in today`, { icon: 'ℹ️' });
      } else {
        toast.success(`${member.name} checked in!`);
      }

      const ms = data.membership;
      if (!ms) {
        toast(`${member.name} has no membership`, { icon: '⚠️', duration: 6000 });
      } else if (ms.status === 'expired') {
        toast(
          `${member.name}'s membership expired ${Math.abs(ms.daysLeft)} day${
            Math.abs(ms.daysLeft) === 1 ? '' : 's'} ago`,
          { icon: '⚠️', duration: 6000 },
        );
      } else if (ms.status === 'expiring') {
        toast(
          ms.daysLeft === 0
            ? `${member.name}'s membership expires today`
            : `${member.name}'s membership expires in ${ms.daysLeft} day${
              ms.daysLeft === 1 ? '' : 's'}`,
          { icon: '⏳', duration: 5000 },
        );
      }

      await loadToday();
      setSearch('');
    } catch (err) {
      toast.error(apiError(err, 'Check-in failed'));
    } finally {
      setChecking(null);
    }
  };

  /**
   * Check a member in from a scan, and show the result panel.
   *
   * Shared by the QR scanner and the fingerprint reader: both arrive at a
   * member id by their own means and then want exactly the same thing done
   * with it. The `label` only names which one is speaking, for the error
   * message — everything else about a hands-free check-in is identical, and
   * writing it twice is how the two would drift.
   *
   * The caller owns the cooldown, because the two devices reset differently:
   * a camera keeps firing at the same code until it is taken away.
   */
  const checkinFromScan = useCallback(async (
    memberId: string,
    label: string,
    known?: { name: string; photo?: string | null },
  ) => {
    try {
      const { data } = await api.post<CheckinResult>(
        '/attendance/checkin', { memberId },
      );

      playBeep();

      // The reader may have told us who this is; the QR scanner has only an
      // id and looks it up in the roster it already holds.
      const member = members.find(m => m.id === memberId);
      const memberName = known?.name || member?.name || 'Member';
      const photo = known?.photo ?? member?.photo;

      const msStatus = data.membership?.status || 'none';

      setLastScanned({
        name: memberName,
        photo,
        status: data.alreadyCheckedIn ? 'already' : msStatus,
      });

      if (data.alreadyCheckedIn) {
        toast(`${memberName} was already checked in today`, { icon: 'ℹ️' });
      } else {
        toast.success(`${memberName} checked in!`);
      }

      const ms = data.membership;
      if (!ms) {
        toast(`${memberName} has no membership`, { icon: '⚠️', duration: 6000 });
      } else if (ms.status === 'expired') {
        toast(
          `${memberName}'s membership expired ${Math.abs(ms.daysLeft)} day${Math.abs(ms.daysLeft) === 1 ? '' : 's'} ago`,
          { icon: '⚠️', duration: 6000 },
        );
      }

      await loadToday();
    } catch (err) {
      toast.error(apiError(err, `${label} check-in failed`));
    }
  }, [members]);

  /** Process a scanned QR code value (memberId UUID). */
  const handleQrScan = useCallback(async (decodedText: string) => {
    if (cooldownRef.current) return;
    cooldownRef.current = true;

    // UUID format check
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(decodedText)) {
      toast.error('Invalid QR code format');
      setTimeout(() => { cooldownRef.current = false; }, 2000);
      return;
    }

    await checkinFromScan(decodedText, 'QR');

    // Cooldown: 3 seconds before allowing another scan
    setTimeout(() => {
      cooldownRef.current = false;
      setLastScanned(null);
    }, 3000);
  }, [checkinFromScan]);

  /**
   * Read a finger and check the member in.
   *
   * Two steps on purpose. `/fingerprint/identify` answers only "who is this",
   * and the check-in that follows is the same one the search tab and the QR
   * scanner post — so the rules about a check-in live in one place and a
   * fingerprint cannot acquire its own dialect of them.
   *
   * A miss is not an error. An unenrolled member putting a finger on the
   * reader is ordinary, and the page says so in place of the result panel
   * rather than through a red toast.
   */
  const handleFingerprintScan = useCallback(async () => {
    if (fpScanning) return;
    setFpScanning(true);
    setFpMessage(null);
    setLastScanned(null);

    try {
      // No body: a locally-matching reader is asked directly, and the backend
      // knows which kind it has. A bridge for a non-matching scanner posts the
      // template it captured to this same endpoint.
      const { data } = await api.post<FingerprintIdentifyResult>(
        '/fingerprint/identify', {},
      );

      if (!data.matched) {
        setFpMessage(
          data.reason === 'no_enrolments'
            ? 'No fingerprints are enrolled yet. Enrol members from their profile page.'
            : 'Fingerprint not recognised. Try again, or use Search Check-In.',
        );
        return;
      }

      await checkinFromScan(data.member.id, 'Fingerprint', {
        name: data.member.name,
        photo: data.member.photo,
      });
    } catch (err) {
      setFpMessage(apiError(err, 'Could not read the fingerprint'));
    } finally {
      setFpScanning(false);
      // Same 3s the camera uses, so the desk sees the result long enough to
      // read it before the panel clears itself for the next member.
      setTimeout(() => setLastScanned(null), 3000);
    }
  }, [fpScanning, checkinFromScan]);

  /** Start the camera scanner. */
  const startScanner = useCallback(async () => {
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          void handleQrScan(decodedText);
        },
        () => {
          // Ignore scan errors (no QR detected in frame)
        },
      );
      setScannerActive(true);
    } catch (err) {
      toast.error('Could not access camera. Please allow camera permissions.');
      console.error(err);
    }
  }, [handleQrScan]);

  /** Stop the camera scanner. */
  const stopScanner = useCallback(async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
      }
      scannerRef.current = null;
      setScannerActive(false);
      setLastScanned(null);
    } catch {
      // Ignore stop errors
    }
  }, []);

  // Cleanup scanner on unmount or tab switch
  useEffect(() => {
    if (activeTab !== 'scanner') {
      void stopScanner();
    }
    return () => { void stopScanner(); };
  }, [activeTab, stopScanner]);

  if (loading) return <PageLoader />;

  const today = new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Page>
      <PageHeader
        icon={CalendarCheck}
        title="Attendance"
        subtitle={today}
        action={
          <div className="flex gap-3">
            <Card className="px-4 py-2.5 text-center">
              <p className="text-xl sm:text-2xl font-bold text-blue-600">{todayList.length}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Checked in</p>
            </Card>
            <Card className="px-4 py-2.5 text-center">
              <p className="text-xl sm:text-2xl font-bold text-gray-400 dark:text-slate-500">
                {Math.max(0, members.length - todayList.length)}
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400">Absent</p>
            </Card>
          </div>
        }
      />

      <div className="mb-5">
        <Card className="p-2 inline-block">
          <SegmentedControl
            value={activeTab}
            onChange={setActiveTab}
            options={[
              { value: 'search', label: 'Search Check-In' },
              { value: 'scanner', label: 'QR Scanner' },
              { value: 'fingerprint', label: 'Fingerprint' },
            ]}
          />
        </Card>
      </div>

      <div className="space-y-5 sm:space-y-6">

      {/* TAB 1: Search Check-In */}
      {activeTab === 'search' && (
      <Card className="p-4 sm:p-5">
        <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-3 flex items-center gap-2">
          <Search size={16} className="text-blue-600" />
          Quick Check-In
        </h2>
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500" />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Type member name or phone number..."
            aria-label="Search member to check in"
            className={`${inputClass} pl-10 py-3`}
            autoFocus
          />
        </div>

        {/* Search Results */}
        {search.trim().length > 0 && (
          <div className="mt-3 space-y-2">
            {filtered.length === 0 ? (
              <div className="text-center py-6 text-gray-400 dark:text-slate-500">
                <UserX size={24} className="mx-auto mb-1" />
                <p className="text-sm">No member found</p>
              </div>
            ) : (
              filtered.slice(0, 8).map(m => {
                const isIn = checkedInIds.has(m.id);
                const isLoading = checking === m.id;
                return (
                  <div key={m.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      isIn ? 'bg-green-50 dark:bg-green-500/15 border-green-200 dark:border-green-500/20' : 'bg-white dark:bg-slate-900 border-gray-100 dark:border-slate-800 hover:border-blue-200 hover:bg-blue-50/30'
                    }`}>
                    <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 overflow-hidden">
                      {m.photo
                        ? <img src={m.photo} alt={m.name} className="w-full h-full object-cover" />
                        : <span className="text-white text-xs font-bold">{getInitials(m.name)}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm truncate">{m.name}</p>
                      <p className="text-xs text-gray-400 dark:text-slate-500">
                        {m.memberNo} · {m.phone || 'No phone'}
                      </p>
                      {/* The front desk needs the membership state before it
                          waves somebody through, not after. */}
                      {m.currentMembership ? (
                        m.currentMembership.status === 'expired' ? (
                          <p className="text-xs font-semibold text-red-600 mt-0.5">
                            Expired {Math.abs(m.currentMembership.daysLeft)}d ago
                          </p>
                        ) : m.currentMembership.status === 'expiring' ? (
                          <p className="text-xs font-semibold text-yellow-700 mt-0.5">
                            Expires in {m.currentMembership.daysLeft}d
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                            {m.currentMembership.planName}
                          </p>
                        )
                      ) : (
                        <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">No membership</p>
                      )}
                    </div>
                    <button
                      onClick={() => void handleCheckin(m)}
                      disabled={isIn || isLoading}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${focusRing} ${
                        isIn
                          ? 'bg-green-100 dark:bg-green-500/15 text-green-700 cursor-default'
                          : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
                      }`}>
                      <CheckCircle2 size={13} />
                      {isIn ? 'Done' : isLoading ? '...' : 'Check In'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        )}

        {search.trim().length === 0 && (
          <p className="text-center text-gray-400 dark:text-slate-500 text-xs mt-4">
            Start typing to search a member
          </p>
        )}
      </Card>
      )}

      {/* TAB 2: QR Scanner */}
      {activeTab === 'scanner' && (
        <Card className="p-4 sm:p-6">
          <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <ScanLine size={16} className="text-blue-600" />
            Camera QR Scanner
          </h2>

          {!scannerActive ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-2xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center mx-auto mb-5">
                <QrCode size={36} className="text-blue-600" />
              </div>
              <p className="text-gray-600 dark:text-slate-300 font-semibold mb-2">Ready to scan member QR codes</p>
              <p className="text-sm text-gray-400 dark:text-slate-500 mb-6 max-w-sm mx-auto">
                Point your camera at a member's QR code for instant check-in. The scanner will automatically detect and process the code.
              </p>
              <button
                onClick={() => void startScanner()}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-500/25"
              >
                <QrCode size={18} />
                Start Camera Scanner
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Camera Feed */}
              <div className="relative rounded-xl overflow-hidden bg-black">
                <div id="qr-reader" className="w-full" />
                <button
                  onClick={() => void stopScanner()}
                  className="absolute top-3 right-3 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors z-10"
                  aria-label="Stop scanner"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scan Result Overlay */}
              {lastScanned && (
                <div className={`p-4 rounded-xl border-2 flex items-center gap-4 animate-fade-in ${
                  lastScanned.status === 'already'
                    ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300'
                    : lastScanned.status === 'expired'
                      ? 'bg-red-50 dark:bg-red-950/20 border-red-300'
                      : 'bg-green-50 dark:bg-green-950/20 border-green-300'
                }`}>
                  <div className="w-14 h-14 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 overflow-hidden">
                    {lastScanned.photo
                      ? <img src={lastScanned.photo} alt={lastScanned.name} className="w-full h-full object-cover" />
                      : <span className="text-white font-bold">{getInitials(lastScanned.name)}</span>
                    }
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-slate-100 text-lg">{lastScanned.name}</p>
                    <p className={`text-sm font-semibold ${
                      lastScanned.status === 'already' ? 'text-yellow-700' :
                      lastScanned.status === 'expired' ? 'text-red-600' :
                      lastScanned.status === 'none' ? 'text-gray-500' :
                      'text-green-700'
                    }`}>
                      {lastScanned.status === 'already' ? '✓ Already checked in today' :
                       lastScanned.status === 'expired' ? '⚠ Checked in — Membership expired!' :
                       lastScanned.status === 'none' ? '✓ Checked in — No membership' :
                       '✓ Checked in successfully!'}
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-center text-gray-400 dark:text-slate-500">
                Hold a member's QR code in front of the camera. The scanner auto-detects and checks in.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: Fingerprint */}
      {activeTab === 'fingerprint' && (
        <Card className="p-4 sm:p-6">
          <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Fingerprint size={16} className="text-blue-600" />
            Fingerprint Check-In
          </h2>

          {/* No reader wired up. Not an error state — most gyms will see this
              until they buy one — so it explains rather than warns. */}
          {!fpStatus?.configured ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-5">
                <Fingerprint size={36} className="text-gray-400 dark:text-slate-500" />
              </div>
              <p className="text-gray-600 dark:text-slate-300 font-semibold mb-2">
                No fingerprint reader is set up
              </p>
              <p className="text-sm text-gray-400 dark:text-slate-500 max-w-sm mx-auto">
                Connect a reader to check members in by fingerprint. Until then,
                use the QR scanner or search by name.
              </p>
            </div>
          ) : !fpStatus.online ? (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-2xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center mx-auto mb-5">
                <AlertCircle size={36} className="text-red-500" />
              </div>
              <p className="text-gray-900 dark:text-slate-100 font-semibold mb-2">
                {fpStatus.label} is not responding
              </p>
              <p className="text-sm text-gray-400 dark:text-slate-500 mb-6 max-w-sm mx-auto">
                Check that it is powered on and connected. Members can still be
                checked in by QR code or by name.
              </p>
              <button
                onClick={() => {
                  void api.get<FingerprintStatus>('/fingerprint/status')
                    .then(r => setFpStatus(r.data))
                    .catch(() => toast.error('Could not reach the reader'));
                }}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors ${focusRing}`}
              >
                Check again
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-center py-8">
                <button
                  onClick={() => void handleFingerprintScan()}
                  disabled={fpScanning}
                  aria-label="Scan fingerprint to check in"
                  className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-5 transition-all ${focusRing} ${
                    fpScanning
                      ? 'bg-blue-100 dark:bg-blue-950/40 animate-pulse cursor-wait'
                      : 'bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 active:scale-95'
                  }`}
                >
                  <Fingerprint size={56} className="text-blue-600" />
                </button>
                <p className="text-gray-600 dark:text-slate-300 font-semibold mb-1">
                  {fpScanning ? 'Reading fingerprint…' : 'Ready to scan'}
                </p>
                <p className="text-sm text-gray-400 dark:text-slate-500">
                  {fpScanning
                    ? 'Ask the member to keep their finger on the reader'
                    : 'Press to scan, then place a finger on the reader'}
                </p>
              </div>

              {/* A miss, or a reader that failed mid-scan. Sits where the
                  result panel would, so the desk looks in one place. */}
              {fpMessage && (
                <div className="p-4 rounded-xl border-2 border-yellow-300 bg-yellow-50 dark:bg-yellow-950/20 flex items-start gap-3">
                  <AlertCircle size={18} className="text-yellow-600 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    {fpMessage}
                  </p>
                </div>
              )}

              {/* Same panel the QR tab shows, for the same reason: whoever is
                  at the desk should see one shape of answer however the member
                  identified themselves. */}
              {lastScanned && (
                <div className={`p-4 rounded-xl border-2 flex items-center gap-4 animate-fade-in ${
                  lastScanned.status === 'already'
                    ? 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-300'
                    : lastScanned.status === 'expired'
                      ? 'bg-red-50 dark:bg-red-950/20 border-red-300'
                      : 'bg-green-50 dark:bg-green-950/20 border-green-300'
                }`}>
                  <div className="w-14 h-14 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 overflow-hidden">
                    {lastScanned.photo
                      ? <img src={lastScanned.photo} alt={lastScanned.name} className="w-full h-full object-cover" />
                      : <span className="text-white font-bold">{getInitials(lastScanned.name)}</span>
                    }
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-slate-100 text-lg">{lastScanned.name}</p>
                    <p className={`text-sm font-semibold ${
                      lastScanned.status === 'already' ? 'text-yellow-700' :
                      lastScanned.status === 'expired' ? 'text-red-600' :
                      lastScanned.status === 'none' ? 'text-gray-500' :
                      'text-green-700'
                    }`}>
                      {lastScanned.status === 'already' ? '✓ Already checked in today' :
                       lastScanned.status === 'expired' ? '⚠ Checked in — Membership expired!' :
                       lastScanned.status === 'none' ? '✓ Checked in — No membership' :
                       '✓ Checked in successfully!'}
                    </p>
                  </div>
                </div>
              )}

              <p className="text-xs text-center text-gray-400 dark:text-slate-500">
                {fpStatus.enrolledCount} member{fpStatus.enrolledCount === 1 ? '' : 's'} enrolled ·{' '}
                {fpStatus.label}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Today's Log */}
      <Card className="p-4 sm:p-5">
        <h2 className="font-bold text-gray-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Users size={16} className="text-blue-600" />
          Today's Log
          <span className="ml-auto bg-blue-100 dark:bg-blue-500/15 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {todayList.length}
          </span>
        </h2>

        {todayList.length === 0 ? (
          <div className="text-center py-10">
            <CalendarCheck size={36} className="text-gray-200 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-gray-400 dark:text-slate-500 text-sm">No check-ins yet today</p>
          </div>
        ) : (
          <div className="space-y-2">
            {todayList.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-slate-800/60 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                <span className="text-xs text-gray-400 dark:text-slate-500 font-mono w-5 text-center">{i + 1}</span>
                <div className="w-9 h-9 rounded-lg bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center overflow-hidden shrink-0">
                  {r.member?.photo
                    ? <img src={r.member.photo} alt={r.member.name} className="w-full h-full object-cover" />
                    : <span className="text-white text-xs font-bold">{getInitials(r.member?.name || '?')}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-slate-100 text-sm truncate">{r.member?.name}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{r.member?.phone || '—'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center gap-1">
                    <Clock size={11} />
                    {new Date(r.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                    <span className="text-xs text-green-600 font-medium">Present</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      </div>
    </Page>
  );
}
