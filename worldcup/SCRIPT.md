# "The Final" — Two-Scene World Cup Script

**Model:** `seedance-2-0-260128` (BytePlus Seedance 2.0 — reference-to-video keeps your
face consistent without forcing the photo to be the first frame)
**Cost:** ~$1.22 per 8-second clip at 720p (audio included)

## Scene 1 — "The Assist" (8s)

> World Cup final, night match, packed 90,000-seat stadium under floodlights.
> The man from the reference image — Black man, shaved head, full beard, black
> rectangular glasses — wearing the sky-blue and white striped Argentina #21 kit,
> dribbles up the center circle at speed, looks up, and threads a perfect
> through-ball between two defenders. Lionel Messi–style #10 sprints onto it and
> buries a low left-footed strike into the bottom corner. The net ripples, the
> goalkeeper dives in vain, the crowd erupts. The #10 points back at the passer
> in thanks. Broadcast TV camera style, hyper-realistic, stadium roar and
> commentator excitement.

## Scene 2 — "The Return" (8s)

> Same World Cup final, minutes later. The legendary Argentine #10 collects the
> ball on the right wing, draws three defenders, and slips a no-look pass into
> the box. The man from the reference image — Black man, shaved head, full
> beard, black rectangular glasses, Argentina #21 kit — arrives at full sprint
> and smashes a first-time shot into the top corner. He wheels away celebrating,
> arms spread wide, sliding on his knees as teammates mob him and flashbulbs pop
> around the stadium. Broadcast TV camera style, hyper-realistic, deafening
> crowd, commentator screaming "GOOOAL".

## Commands (run from this folder once `me.jpg` is here)

```bash
gmi generate -m seedance-2-0-260128 \
  --image ./me.jpg --image-key reference_images \
  -p "<Scene 1 prompt>" \
  --payload '{"duration":8,"resolution":"720p","ratio":"16:9","generate_audio":true}' \
  -o ./clips

gmi generate -m seedance-2-0-260128 \
  --image ./me.jpg --image-key reference_images \
  -p "<Scene 2 prompt>" \
  --payload '{"duration":8,"resolution":"720p","ratio":"16:9","generate_audio":true}' \
  -o ./clips
```

Note: the model may soften an exact celebrity likeness; the prompt says
"Messi-style #10" so the scene works either way.
