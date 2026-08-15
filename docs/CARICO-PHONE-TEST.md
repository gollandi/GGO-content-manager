# Il Carico — the phone test

The upload path has been proven on the server (assembly, resume, checksum)
and by a real 66 MB deposit from JJ's phone. What no test on the server can
prove is the part that actually breaks in the field: a large clip over 4G,
through a radio that drops. This is that test, and only JJ can run it —
it needs his phone, his session, and a mobile network.

Run it once. If it passes, Il Carico is trustworthy for the material it
was built for; if it fails, that failure outranks every other piece of
work in flight.

## What to send

A **real clip over 100 MB** — a full talking-head take, not a screen
recording. Bigger is a better test: at 5 MiB chunks a 500 MB clip is ~100
requests, which is where a flaky radio shows itself.

## The test

1. **Phone off Wi-Fi, on 4G/5G.** The Mac must not be involved at any
   point — that is the whole premise.
2. Open `https://cockpit.ggo-suite.co.uk/carico`, sign in, pick the clip,
   choose the right kind (`Talking head` for a take), add a note.
3. Start the upload. Let it run past 30%.
4. **Aeroplane mode on.** The upload must stop and say so, not silently
   die or pretend to continue.
5. Wait ~30 seconds. **Aeroplane mode off**, wait for signal.
6. Press **Riprendi**. It must carry on from where it stopped — the
   progress must not restart from zero.
7. Let it finish. It should end in "pronto" and appear in the inbox list
   below.

## What proves it worked

Not the green tick on the phone — the bytes on the server. On the Mac:

```bash
ssh -i ~/.ssh/ionos_ggo_xl root@85.215.37.39 \
  'ls -la /srv/ggo-media/inbox/ && sha256sum /srv/ggo-media/inbox/*.mp4'
```

Compare against the original still on the phone (AirDrop it to the Mac and
`shasum -a 256 <file>`). Three things must agree:

- the **size** on the server equals the original,
- the **sha256** matches, byte for byte,
- `receivedBytes == declaredBytes` in the manifest `inbox/<id>.json`.

A size match with a checksum mismatch would be the worst outcome and the
most important to catch: it would mean chunks assembled in the wrong order.

## What happens next, on its own

Within five minutes the worker picks the manifest up (`ggo-carico-worker.timer`)
and the row on `/carico` changes from "in attesa del worker" to "lavorato",
listing what it made. For a talking head that is a poster, a 16 kHz audio
track, and a Whisper transcript:

```bash
ssh -i ~/.ssh/ionos_ggo_xl root@85.215.37.39 \
  'ls -la /srv/ggo-media/ready/*/ && journalctl -u ggo-carico-worker.service -n 20 --no-pager'
```

## If it fails

Capture, before anything else: the phone's screen at the moment it broke,
`journalctl -u ggo-content-manager -n 100` on the server, and the contents
of `/srv/ggo-media/staging/<id>/` (the parts that did arrive). The staging
directory is the evidence — it says exactly which chunk was lost.
