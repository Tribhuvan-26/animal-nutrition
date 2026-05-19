'use client';

const PHOTOS = [
  '/photos/photo1.jpg',
  '/photos/photo2.jpg',
  '/photos/photo3.jpg',
  '/photos/photo4.jpg',
  '/photos/photo5.jpg',
  '/photos/photo6.jpg',
  '/photos/photo7.jpg',
  '/photos/photo8.jpg',
  '/photos/photo9.jpg',
  '/photos/photo10.jpg',
  '/photos/photo11.jpeg',
];

// In-flow masonry that makes the page scrollable. The card overlays this
// (see .card-overlay in globals.css) so photos are visible behind it.
// Shuffles photos once per mount so the order varies and no two duplicates land adjacent.
export default function PhotoMasonry({ columns = 4 }) {
  const items = shuffle(PHOTOS);

  return (
    <div className="masonry-bg">
      <div className="masonry" style={{ '--cols': columns }}>
        {items.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt=""
            className="masonry-item"
            style={{ animationDelay: `${i * 80}ms` }}
            loading="lazy"
            draggable={false}
          />
        ))}
      </div>
    </div>
  );
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
