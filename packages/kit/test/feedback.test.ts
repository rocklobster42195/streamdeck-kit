import { describe, expect, it, vi } from 'vitest';
import { feedbackFrame, isFeedbackPlaying, playFeedback } from '../src/render/feedback.js';

const svg = (uri: string) => Buffer.from(uri.split(',')[1], 'base64').toString('utf8');

describe('key feedback', () => {
    it('grows a disc in the key colour and draws a check mark', () => {
        const start = svg(feedbackFrame('ok', 0, { color: '#005DA0' }));
        const mid = svg(feedbackFrame('ok', 0.5, { color: '#005DA0' }));
        expect(start).toContain('r="0.0" fill="#005DA0"');
        expect(mid).toContain('r="52.0" fill="#005DA0"');
        expect(mid).toContain('<polyline');
        expect(svg(feedbackFrame('ok', 0.6))).toContain('fill="#F7A600"');
    });

    it('shows an exclamation mark on red for alerts', () => {
        const end = svg(feedbackFrame('alert', 0.8));
        expect(end).toContain('fill="#E30018"');
        expect(end).toContain('<line');
        expect(end).toContain('cy="101"');
    });

    it('fits a dial strip, centred', () => {
        const strip = svg(feedbackFrame('ok', 0.5, { width: 200, height: 100 }));
        expect(strip).toContain('width="200" height="100"');
        expect(strip).toContain('translate(50.0 0.0) scale(0.6944)');
    });

    it('plays frames, then gives the key back', () => {
        vi.useFakeTimers();
        const images: (string | undefined)[] = [];
        const restore = vi.fn();
        playFeedback('k1', { setImage: (i) => images.push(i) }, 'ok', { restore });
        expect(isFeedbackPlaying('k1')).toBe(true);
        vi.advanceTimersByTime(800);
        expect(restore).toHaveBeenCalledOnce();
        expect(isFeedbackPlaying('k1')).toBe(false);
        expect(images.length).toBeGreaterThan(10);
        vi.useRealTimers();
    });
});
