# 사이거리

출발지와 도착지를 검색해 선택하면 자동차 경로 거리와 OpenStreetMap 길찾기 링크를 보여주는 한국어 정적 웹앱입니다.

## 실행

`index.html`을 브라우저에서 열거나 정적 파일 서버로 제공하면 됩니다. 빌드, 서버 함수, Redis, API 키 또는 환경변수가 필요하지 않습니다. 이 프로젝트를 GitHub에 올린 뒤 Vercel에서 저장소를 가져오면 별도의 빌드 설정 없이 배포할 수 있습니다.

## 데이터와 거리 계산

- 장소 검색: [Nominatim](https://nominatim.openstreetmap.org/)
- 자동차 경로 거리: [OSRM 공개 데모 서버](https://router.project-osrm.org/)
- 지도 링크: OpenStreetMap 자동차 길찾기

Nominatim 검색은 브라우저에서 직접 요청하며, 앱 내 요청을 순차화하고 요청 간격을 두었습니다. 공개 API는 사용량 정책과 서비스 한도가 있으며 가용성이나 응답 속도를 보장하지 않습니다. OSRM 공개 데모 서버도 별도 SLA가 없는 공개 서비스이므로, 사용량이 많은 상용 서비스에는 적합하지 않을 수 있습니다.
