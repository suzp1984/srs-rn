/**
 * @format
 */
import 'react-native';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {describe, it, expect, jest} from '@jest/globals';
import {TsUrlScreen} from '../features/ts/TsUrlScreen';
import {DEFAULT_TS_URL} from '../features/ts/validation';

function findByTestID(root: ReactTestRenderer.ReactTestInstance, id: string) {
  return root.findByProps({testID: id});
}
function hasError(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByProps({testID: 'ts-url-error'}).length > 0;
}

function render() {
  const navigate = jest.fn();
  const navigation = {navigate, goBack: () => {}, addListener: () => () => {}} as never;
  const route = {key: 'TsUrl-test', name: 'TsUrl' as const} as never;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<TsUrlScreen navigation={navigation} route={route} />);
  });
  return {tree, navigate};
}

describe('TsUrlScreen', () => {
  it('prefills the input with DEFAULT_TS_URL on mount', () => {
    const {tree} = render();
    expect(findByTestID(tree.root, 'ts-url-input').props.value).toBe(DEFAULT_TS_URL);
  });
  it('navigates to TsPlayer with the default URL when Connect is tapped', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'ts-url-connect').props.onPress();
    });
    expect(navigate).toHaveBeenCalledWith('TsPlayer', {tsUrl: DEFAULT_TS_URL});
  });
  it('shows an error and does not navigate when the URL is invalid', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'ts-url-input').props.onChangeText('not a url');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'ts-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('shows an error for rtmp URLs and does not navigate', () => {
    const {tree, navigate} = render();
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'ts-url-input').props.onChangeText('rtmp://example.com/live/stream');
    });
    ReactTestRenderer.act(() => {
      findByTestID(tree.root, 'ts-url-connect').props.onPress();
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(hasError(tree.root)).toBe(true);
  });
  it('keeps the URL editable', () => {
    const {tree} = render();
    const input = findByTestID(tree.root, 'ts-url-input');
    ReactTestRenderer.act(() => {
      input.props.onChangeText('http://10.0.0.5:8080/live/stream.ts');
    });
    expect(input.props.value).toBe('http://10.0.0.5:8080/live/stream.ts');
  });
});
