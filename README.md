# 제주도 함께가기 (Jeju Together)

로그인 없이 친구들과 함께 제주를 걸어 다니는 3D 웹게임입니다.
게임 화면은 `public/index.html`, 실시간 중계 서버는 `src/worker.js`(Cloudflare Worker + Durable Object)입니다.
한 방에 최대 30명, 30명이 차면 다음 방이 새로 열립니다. 서버에는 아무것도 저장되지 않습니다.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/edwardljs/jeju-together)
