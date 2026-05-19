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
export default function PhotoMasonry({ columns = 4, repeat = 6 }) {
  const items = Array.from({ length: repeat }).flatMap(() => PHOTOS);

  return (
    <div className="masonry-bg">
      <div className="masonry" style={{ '--cols': columns }}>
        {items.map((src, i) => (
          <img
            key={`${src}-${i}`}
            src={src}
            alt=""
            className="masonry-item"
            style={{ animationDelay: `${(i % 11) * 80}ms` }}
            loading="lazy"
            draggable={false}
          />
        ))}
      </div>
    </div>
  );
}
